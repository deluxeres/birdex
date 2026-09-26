// BIRDEX API (Cloudflare Worker + D1).
// Всё под /api/* обрабатывает этот код, остальное — статические файлы игры.
//
// Авторизация: каждый запрос несёт заголовок  Authorization: tma <initData>
// initData подписана Telegram — сервер проверяет подпись токеном бота (секрет BOT_TOKEN).
//
//   POST /api/auth         — вход; создаёт игрока, записывает реферала (startapp=ref_<id>)
//   GET  /api/state        — сохранённый прогресс
//   PUT  /api/state        — сохранить прогресс
//   GET  /api/leaderboard?by=coins|play — топ-50 по монетам / по рекорду в Play + моё место
//   GET  /api/friends      — кого я пригласил + сколько 12% накопилось
//   POST /api/ref/claim    — забрать накопленные 12%
//   POST /api/channel/check — подписан ли игрок на канал (спрашиваем у Telegram)
//   POST /api/channel/claim — бонус за подписку (один раз на аккаунт)
//   POST /api/games/chicken-flight/start|collect, GET .../active — Chicken Flight (тратит 30 энергии режима run)
//   GET  /api/games/double/history, POST /api/games/double/spin — Дабл (тратит 30 энергии режима double)

import { verifyInitData, type TgAuth } from './telegramAuth'
import { ensureSchema, type ChickenFlightRow, type D1Database, type UserRow } from './db'
import { CHICKEN_FLIGHT, crashMultiplierForFlight, flightElapsedForMultiplier, flightMultiplierAt, flightReward } from './chickenFlight'
import { DOUBLE, doubleReward, doubleSlotColor, randomDoubleSlot, type DoubleColor } from './double'
import { spendModeEnergy, type ModeEnergy } from './modeEnergy'

/** Энергия за один запуск Chicken Flight. */
const FLIGHT_ENERGY_COST = 30

interface Env {
  DB: D1Database
  BOT_TOKEN: string
  /** ID канала для бонуса за подписку, вида -1001234567890. Бот должен быть админом канала. */
  CHANNEL_ID?: string
  ASSETS: { fetch(req: Request): Promise<Response> }
}

/** Максимальный размер сохранения (защита от мусора). */
const MAX_STATE_BYTES = 64 * 1024
/** Друг считается активным, когда дорос до этого уровня. */
const ACTIVE_FRIEND_LEVEL = 2
/** % с продажи яиц друга, который идёт пригласившему. */
const REF_PERCENT = 12
/** 12% от суммы, вверх до целой монеты. Целочисленно, чтобы не было ошибок вида 54.00000001 → 55. */
const refShare = (coins: number) => Math.ceil((coins * REF_PERCENT) / 100)
/** Бонус за подписку на канал. */
const CHANNEL_BONUS_COINS = 1000

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

const fail = (code: string, status = 400) => json({ error: code }, status)

function displayName(u: { first_name: string; username?: string | null }): string {
  return (u.first_name || u.username || 'Фермер').slice(0, 32)
}

async function auth(req: Request, env: Env): Promise<TgAuth | null> {
  const h = req.headers.get('authorization') ?? ''
  if (!h.startsWith('tma ')) return null
  return verifyInitData(h.slice(4), env.BOT_TOKEN)
}

function parseRef(startParam: string | null, selfId: number): number | null {
  const m = /^ref_(\d{1,20})$/.exec(startParam ?? '')
  if (!m) return null
  const id = Number(m[1])
  return Number.isSafeInteger(id) && id !== selfId ? id : null
}

async function handleAuth(a: TgAuth, env: Env): Promise<Response> {
  const now = Date.now()
  const u = a.user
  const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first<UserRow>()
  if (existing) {
    await env.DB.prepare('UPDATE users SET username = ?, first_name = ?, updated_at = ? WHERE id = ?')
      .bind(u.username ?? null, displayName(u), now, u.id)
      .run()
  } else {
    // Реферал записывается только при ПЕРВОМ входе и только если пригласивший существует.
    let refBy = parseRef(a.startParam, u.id)
    if (refBy) {
      const inviter = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(refBy).first()
      if (!inviter) refBy = null
    }
    await env.DB.prepare(
      'INSERT INTO users (id, username, first_name, referred_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(u.id, u.username ?? null, displayName(u), refBy, now, now)
      .run()
  }
  const row = await env.DB.prepare('SELECT state FROM users WHERE id = ?').bind(u.id).first<{ state: string | null }>()
  return json({
    user: { id: String(u.id), name: displayName(u) },
    state: row?.state ? JSON.parse(row.state) : null,
  })
}

interface SavedState {
  profile?: { farmName?: string; level?: number; xp?: number; avatar?: string }
  balance?: { coins?: number; eggs?: number }
  events?: { invite5Claimed?: boolean; invite10Claimed?: boolean; invite25Claimed?: boolean; invite100Claimed?: boolean; channelSubscribed?: boolean; channelBonusClaimed?: boolean }
  season?: { points?: number }
  chickens?: unknown[]
  stats?: { soldCoins?: number; bestPlay?: number }
  modeEnergy?: Record<string, ModeEnergy>
}

/** Целое неотрицательное число из сохранения (мусор → 0). */
const num = (v: unknown, max = 1e15) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))

async function handleSave(a: TgAuth, req: Request, env: Env): Promise<Response> {
  const text = await req.text()
  if (text.length > MAX_STATE_BYTES) return fail('TOO_LARGE', 413)
  let state: SavedState
  try {
    state = JSON.parse(text) as SavedState
  } catch {
    return fail('BAD_JSON')
  }
  // ⚠️ Экономика пока считается в игре — сервер только хранит и базово проверяет.
  const level = Math.max(1, Math.min(50, num(state.profile?.level) || 1))
  const xp = num(state.profile?.xp)
  const coins = num(state.balance?.coins)
  const chickens = Array.isArray(state.chickens) ? Math.min(36, state.chickens.length) : 1
  const farmName = String(state.profile?.farmName ?? '').slice(0, 24) || null
  const avatar = /^[a-z0-9_]{1,24}$/.test(String(state.profile?.avatar ?? '')) ? String(state.profile!.avatar) : null
  const bestPlay = num(state.stats?.bestPlay)

  // Два сохранения могут прийти одновременно: обновляем только если sold_total не изменился
  // с момента чтения (иначе перечитываем) — так 12% не начислятся дважды.
  for (let attempt = 0; attempt < 3; attempt++) {
    const me = await env.DB.prepare('SELECT sold_total, referred_by FROM users WHERE id = ?')
      .bind(a.user.id)
      .first<Pick<UserRow, 'sold_total' | 'referred_by'>>()
    if (!me) return fail('NO_USER', 404)
    // Продажи считаем по максимуму: если сохранение "откатилось", повторно не начисляем.
    const sold = Math.max(me.sold_total, num(state.stats?.soldCoins))
    // Считаем от общей суммы продаж и округляем вверх: даже продажа 1 яйца (5 монет → 0.6)
    // сразу даёт пригласившему 1 монету, а в сумме всё равно выходит ровно 12% (без лишнего).
    const refBonus = me.referred_by ? refShare(sold) - refShare(me.sold_total) : 0
    const res = (await env.DB.prepare(
      `UPDATE users SET state = ?, level = ?, xp = ?, coins = ?, chickens = ?, farm_name = ?, avatar = ?,
         best_play = MAX(best_play, ?), sold_total = ?, ref_given = ref_given + ?, updated_at = ?
       WHERE id = ? AND sold_total = ?`,
    )
      .bind(text, level, xp, coins, chickens, farmName, avatar, bestPlay, sold, refBonus, Date.now(), a.user.id, me.sold_total)
      .run()) as { meta?: { changes?: number } }
    if (res?.meta?.changes === 0) continue
    // 12% с продажи яиц друга — пригласившему, он забирает кнопкой в "Друзьях".
    if (me.referred_by && refBonus > 0) {
      await env.DB.prepare('UPDATE users SET ref_pending = ref_pending + ?, ref_total = ref_total + ? WHERE id = ?')
        .bind(refBonus, refBonus, me.referred_by)
        .run()
    }
    return json({ ok: true })
  }
  return fail('BUSY', 409)
}

/** Рейтинг: by=coins — у кого больше монет, by=play — рекорд яиц за одну игру. */
async function handleLeaderboard(a: TgAuth, env: Env, by: string): Promise<Response> {
  const col = by === 'play' ? 'best_play' : 'coins'
  const top = await env.DB.prepare(
    `SELECT id, first_name, farm_name, level, avatar, ${col} AS value FROM users
     WHERE ${col} > 0 ORDER BY ${col} DESC, created_at ASC LIMIT 50`,
  ).all<Pick<UserRow, 'id' | 'first_name' | 'farm_name' | 'level' | 'avatar'> & { value: number }>()
  const me = await env.DB.prepare(`SELECT ${col} AS value, created_at FROM users WHERE id = ?`)
    .bind(a.user.id)
    .first<{ value: number; created_at: number }>()
  const rank = me && me.value > 0
    ? ((await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE ${col} > ? OR (${col} = ? AND created_at < ?)`)
        .bind(me.value, me.value, me.created_at)
        .first<{ n: number }>())?.n ?? 0) + 1
    : null
  return json({
    top: top.results.map((r, i) => ({
      rank: i + 1,
      name: r.first_name,
      farmName: r.farm_name,
      level: r.level,
      avatar: r.avatar,
      value: r.value,
      isMe: r.id === a.user.id,
    })),
    me: me && rank ? { rank, value: me.value } : null,
  })
}

async function handleFriends(a: TgAuth, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT id, first_name, farm_name, level, coins, avatar, ref_given FROM users
     WHERE referred_by = ? ORDER BY ref_given DESC, created_at DESC LIMIT 200`,
  )
    .bind(a.user.id)
    .all<Pick<UserRow, 'id' | 'first_name' | 'farm_name' | 'level' | 'coins' | 'avatar' | 'ref_given'>>()
  const me = await env.DB.prepare('SELECT ref_pending, ref_total FROM users WHERE id = ?')
    .bind(a.user.id)
    .first<Pick<UserRow, 'ref_pending' | 'ref_total'>>()
  return json({
    friends: rows.results.map((r) => ({
      id: String(r.id),
      name: r.first_name,
      farmName: r.farm_name,
      level: r.level,
      coins: r.coins,
      avatar: r.avatar,
      earned: r.ref_given,
      active: r.level >= ACTIVE_FRIEND_LEVEL,
    })),
    pending: me?.ref_pending ?? 0,
    total: me?.ref_total ?? 0,
  })
}

/** Забрать накопленные 12% с друзей. Списываем ровно то, что отдали (новое не теряется). */
async function handleRefClaim(a: TgAuth, env: Env): Promise<Response> {
  const me = await env.DB.prepare('SELECT ref_pending FROM users WHERE id = ?')
    .bind(a.user.id)
    .first<Pick<UserRow, 'ref_pending'>>()
  const coins = me?.ref_pending ?? 0
  if (coins > 0) {
    await env.DB.prepare('UPDATE users SET ref_pending = ref_pending - ? WHERE id = ? AND ref_pending >= ?')
      .bind(coins, a.user.id, coins)
      .run()
  }
  return json({ coins })
}

const INVITE_TASK_REWARDS = {
  5: { coins: 20000, birdPoints: 0 },
  10: { coins: 50000, birdPoints: 0 },
  25: { coins: 150000, birdPoints: 250 },
  100: { coins: 800000, birdPoints: 2000 },
} as const

async function handleInviteTaskClaim(a: TgAuth, req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { target?: unknown } | null
  const target = Number(body?.target)
  if (target !== 5 && target !== 10 && target !== 25 && target !== 100) return fail('BAD_AMOUNT')
  const friends = (await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?')
    .bind(a.user.id)
    .first<{ n: number }>())?.n ?? 0
  if (friends < target) return fail('NOT_ENOUGH_FRIENDS')
  const row = await env.DB.prepare('SELECT state FROM users WHERE id = ?').bind(a.user.id).first<Pick<UserRow, 'state'>>()
  if (!row) return fail('NO_USER', 404)
  const state = parseState(row.state)
  state.balance = { ...(state.balance ?? {}), coins: num(state.balance?.coins) }
  state.events = { ...(state.events ?? {}) }
  const key = target === 5 ? 'invite5Claimed' : target === 10 ? 'invite10Claimed' : target === 25 ? 'invite25Claimed' : 'invite100Claimed'
  if (state.events[key]) return fail('BONUS_CLAIMED')
  const { coins, birdPoints } = INVITE_TASK_REWARDS[target]
  state.events[key] = true
  state.balance.coins = num(state.balance.coins + coins)
  if (birdPoints > 0) {
    state.season = { ...(state.season ?? {}), points: num(state.season?.points) + birdPoints }
  }
  await env.DB.prepare('UPDATE users SET state = ?, coins = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(state), state.balance.coins, Date.now(), a.user.id)
    .run()
  return json({ coins, birdPoints, state })
}

/**
 * Подписан ли игрок на канал — спрашиваем у Telegram (getChatMember).
 * Работает, только если бот добавлен в канал администратором.
 */
async function isSubscribed(env: Env, userId: number): Promise<boolean> {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(env.CHANNEL_ID!)}&user_id=${userId}`
  const res = await fetch(url)
  const data = (await res.json()) as { ok: boolean; description?: string; result?: { status: string; is_member?: boolean } }
  if (!data.ok) throw new Error(`getChatMember: ${data.description ?? res.status}`)
  const st = data.result?.status
  return st === 'creator' || st === 'administrator' || st === 'member' || (st === 'restricted' && !!data.result?.is_member)
}

async function handleChannel(a: TgAuth, env: Env, claim: boolean): Promise<Response> {
  if (!env.CHANNEL_ID) return fail('NO_CHANNEL', 503)
  const me = await env.DB.prepare('SELECT channel_bonus FROM users WHERE id = ?')
    .bind(a.user.id)
    .first<Pick<UserRow, 'channel_bonus'>>()
  if (!me) return fail('NO_USER', 404)
  let subscribed: boolean
  try {
    subscribed = await isSubscribed(env, a.user.id)
  } catch (e) {
    console.error(e) // чаще всего: бот не админ канала или неверный CHANNEL_ID
    return fail('CHANNEL_CHECK_FAILED', 502)
  }
  const claimed = me.channel_bonus === 1
  if (!claim) return json({ subscribed, claimed })
  if (!subscribed) return fail('CHANNEL_NOT_SUBSCRIBED')
  if (claimed) return fail('CHANNEL_BONUS_CLAIMED')
  // Выдаём ровно один раз: обновится только строка, где бонуса ещё не было.
  const res = (await env.DB.prepare('UPDATE users SET channel_bonus = 1 WHERE id = ? AND channel_bonus = 0')
    .bind(a.user.id)
    .run()) as { meta?: { changes?: number } }
  if (res?.meta?.changes === 0) return fail('CHANNEL_BONUS_CLAIMED')
  return json({ subscribed: true, claimed: true, coins: CHANNEL_BONUS_COINS })
}

function parseState(text: string | null): SavedState {
  if (!text) return {}
  try {
    return JSON.parse(text) as SavedState
  } catch {
    return {}
  }
}

async function getStateForFlight(a: TgAuth, env: Env): Promise<{ row: Pick<UserRow, 'state'>; state: SavedState }> {
  const row = await env.DB.prepare('SELECT state FROM users WHERE id = ?').bind(a.user.id).first<Pick<UserRow, 'state'>>()
  if (!row) throw new Error('NO_USER')
  return { row, state: parseState(row.state) }
}

function flightPublic(row: ChickenFlightRow) {
  return {
    sessionId: row.id,
    amount: row.amount,
    startedAt: row.started_at,
    status: row.status,
  }
}

async function settleExpiredFlights(userId: number, env: Env): Promise<void> {
  await env.DB.prepare(
    `UPDATE chicken_flights SET status = 'CRASHED'
     WHERE user_id = ? AND status = 'FLYING' AND crash_at <= ?`,
  )
    .bind(userId, Date.now())
    .run()
}

async function flightHistory(a: TgAuth, env: Env) {
  const rows = await env.DB.prepare(
    `SELECT id, status, amount, COALESCE(collect_multiplier, crash_multiplier) AS multiplier, reward, created_at
     FROM chicken_flights WHERE user_id = ? AND status != 'FLYING'
     ORDER BY created_at DESC LIMIT ?`,
  )
    .bind(a.user.id, CHICKEN_FLIGHT.historyLimit)
    .all<{ id: string; status: 'COLLECTED' | 'CRASHED'; amount: number; multiplier: number; reward: number; created_at: number }>()
  return rows.results.map((r) => ({
    id: r.id,
    status: r.status,
    amount: r.amount,
    multiplier: r.multiplier,
    reward: r.reward,
    createdAt: r.created_at,
  }))
}

async function handleFlightActive(a: TgAuth, env: Env): Promise<Response> {
  await settleExpiredFlights(a.user.id, env)
  const { state } = await getStateForFlight(a, env)
  const active = await env.DB.prepare(
    `SELECT * FROM chicken_flights WHERE user_id = ? AND status = 'FLYING'
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(a.user.id)
    .first<ChickenFlightRow>()
  const history = await flightHistory(a, env)
  return json({
    session: active ? { ...flightPublic(active), state } : null,
    history,
    stats: {
      flights: history.length,
      bestMultiplier: history.reduce((m, x) => Math.max(m, x.status === 'COLLECTED' ? x.multiplier : 0), 0),
      largestReward: history.reduce((m, x) => Math.max(m, x.reward), 0),
      totalCollected: history.reduce((m, x) => m + (x.status === 'COLLECTED' ? x.reward : 0), 0),
    },
    state,
  })
}

async function handleFlightStart(a: TgAuth, req: Request, env: Env): Promise<Response> {
  await settleExpiredFlights(a.user.id, env)
  const body = (await req.json().catch(() => null)) as { amount?: unknown } | null
  const amount = Math.floor(Number(body?.amount))
  if (!Number.isFinite(amount) || amount < CHICKEN_FLIGHT.minAmount || amount > CHICKEN_FLIGHT.maxAmount) return fail('BAD_AMOUNT')
  const already = await env.DB.prepare('SELECT id FROM chicken_flights WHERE user_id = ? AND status = ? LIMIT 1')
    .bind(a.user.id, 'FLYING')
    .first()
  if (already) return fail('FLIGHT_ACTIVE', 409)
  const { state } = await getStateForFlight(a, env)
  const eggs = num(state.balance?.eggs)
  if (amount > eggs) return fail('NOT_ENOUGH_EGGS')

  const now = Date.now()
  if (!spendModeEnergy(state, 'run', FLIGHT_ENERGY_COST, now)) return fail('NO_ENERGY')
  const done = await env.DB.prepare('SELECT COUNT(*) AS n FROM chicken_flights WHERE user_id = ?').bind(a.user.id).first<{ n: number }>()
  const crashMultiplier = crashMultiplierForFlight((done?.n ?? 0) + 1)
  const sessionId = crypto.randomUUID()
  state.balance = { ...(state.balance ?? {}), eggs: eggs - amount }
  const stateText = JSON.stringify(state)
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET state = ?, updated_at = ? WHERE id = ?').bind(stateText, now, a.user.id),
    env.DB.prepare(
      `INSERT INTO chicken_flights
       (id, user_id, amount, started_at, crash_at, crash_multiplier, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'FLYING', ?)`,
    ).bind(sessionId, a.user.id, amount, now, now + flightElapsedForMultiplier(crashMultiplier), crashMultiplier, now),
  ])
  return json({ sessionId, amount, startedAt: now, status: 'FLYING', state })
}

async function handleFlightCollect(a: TgAuth, req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { sessionId?: unknown } | null
  const sessionId = String(body?.sessionId ?? '')
  if (!sessionId) return fail('BAD_SESSION')
  const row = await env.DB.prepare('SELECT * FROM chicken_flights WHERE id = ? AND user_id = ?')
    .bind(sessionId, a.user.id)
    .first<ChickenFlightRow>()
  if (!row) return fail('BAD_SESSION', 404)

  const { state } = await getStateForFlight(a, env)
  if (row.status !== 'FLYING') {
    const history = await flightHistory(a, env)
    return json({
      success: row.status === 'COLLECTED',
      status: row.status,
      multiplier: row.collect_multiplier ?? row.crash_multiplier,
      reward: row.reward,
      amount: row.amount,
      state,
      history,
    })
  }

  const now = Date.now()
  const crashed = now >= row.crash_at
  const multiplier = crashed ? row.crash_multiplier : flightMultiplierAt(now - row.started_at)
  const reward = crashed ? 0 : flightReward(row.amount, multiplier)
  if (!crashed) {
    const eggs = num(state.balance?.eggs)
    state.balance = { ...(state.balance ?? {}), eggs: eggs + reward }
  }
  const stateText = JSON.stringify(state)
  const status = crashed ? 'CRASHED' : 'COLLECTED'
  const res = (await env.DB.prepare(
    `UPDATE chicken_flights SET status = ?, collect_multiplier = ?, reward = ?
     WHERE id = ? AND user_id = ? AND status = 'FLYING'`,
  )
    .bind(status, multiplier, reward, row.id, a.user.id)
    .run()) as { meta?: { changes?: number } }
  if (res?.meta?.changes === 0) {
    const fresh = await env.DB.prepare('SELECT * FROM chicken_flights WHERE id = ? AND user_id = ?')
      .bind(sessionId, a.user.id)
      .first<ChickenFlightRow>()
    if (!fresh) return fail('BAD_SESSION', 404)
    const history = await flightHistory(a, env)
    return json({
      success: fresh.status === 'COLLECTED',
      status: fresh.status,
      multiplier: fresh.collect_multiplier ?? fresh.crash_multiplier,
      reward: fresh.reward,
      amount: fresh.amount,
      state,
      history,
    })
  }
  if (!crashed) {
    await env.DB.prepare('UPDATE users SET state = ?, best_play = MAX(best_play, ?), updated_at = ? WHERE id = ?')
      .bind(stateText, reward, now, a.user.id)
      .run()
  }
  const history = await flightHistory(a, env)
  return json({ success: !crashed, status, multiplier, reward, amount: row.amount, state, history })
}

// ── Дабл ──
async function doubleHistory(a: TgAuth, env: Env) {
  const rows = await env.DB.prepare(
    'SELECT id, bet, slot, color, amount, reward, created_at FROM double_spins WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
  )
    .bind(a.user.id, DOUBLE.historyLimit)
    .all<{ id: string; bet: DoubleColor; slot: number; color: DoubleColor; amount: number; reward: number; created_at: number }>()
  return rows.results.map((r) => ({
    id: r.id, bet: r.bet, slot: r.slot, color: r.color, amount: r.amount, reward: r.reward, createdAt: r.created_at,
  }))
}

async function handleDoubleSpin(a: TgAuth, req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { amount?: unknown; bet?: unknown } | null
  const amount = Math.floor(Number(body?.amount))
  const bet = String(body?.bet ?? '') as DoubleColor
  if (!Number.isFinite(amount) || amount < DOUBLE.minAmount || amount > DOUBLE.maxAmount) return fail('BAD_AMOUNT')
  if (bet !== 'red' && bet !== 'black' && bet !== 'green') return fail('BAD_BET')
  const { state } = await getStateForFlight(a, env)
  const eggs = num(state.balance?.eggs)
  if (amount > eggs) return fail('NOT_ENOUGH_EGGS')
  const now = Date.now()
  if (!spendModeEnergy(state, 'double', DOUBLE.playCost, now)) return fail('NO_ENERGY')

  const slot = randomDoubleSlot()
  const color = doubleSlotColor(slot)
  const reward = doubleReward(amount, bet, color)
  state.balance = { ...(state.balance ?? {}), eggs: eggs - amount + reward }
  const id = crypto.randomUUID()
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET state = ?, best_play = MAX(best_play, ?), updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(state), reward, now, a.user.id),
    env.DB.prepare('INSERT INTO double_spins (id, user_id, amount, bet, slot, color, reward, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, a.user.id, amount, bet, slot, color, reward, now),
  ])
  const history = await doubleHistory(a, env)
  return json({ id, slot, color, win: reward > 0, amount, bet, reward, state, history })
}

async function handleApi(req: Request, env: Env, path: string): Promise<Response> {
  if (!env.DB) return fail('NO_DB', 503)
  if (!env.BOT_TOKEN) return fail('NO_BOT_TOKEN', 503)
  const a = await auth(req, env)
  if (!a) return fail('UNAUTHORIZED', 401)
  await ensureSchema(env.DB)
  const m = req.method
  if (path === '/api/auth' && m === 'POST') return handleAuth(a, env)
  if (path === '/api/state' && m === 'PUT') return handleSave(a, req, env)
  if (path === '/api/leaderboard' && m === 'GET') return handleLeaderboard(a, env, new URL(req.url).searchParams.get('by') ?? 'coins')
  if (path === '/api/friends' && m === 'GET') return handleFriends(a, env)
  if (path === '/api/ref/claim' && m === 'POST') return handleRefClaim(a, env)
  if (path === '/api/ref/task-claim' && m === 'POST') return handleInviteTaskClaim(a, req, env)
  if (path === '/api/channel/check' && m === 'POST') return handleChannel(a, env, false)
  if (path === '/api/channel/claim' && m === 'POST') return handleChannel(a, env, true)
  if (path === '/api/games/chicken-flight/active' && m === 'GET') return handleFlightActive(a, env)
  if (path === '/api/games/chicken-flight/start' && m === 'POST') return handleFlightStart(a, req, env)
  if (path === '/api/games/chicken-flight/collect' && m === 'POST') return handleFlightCollect(a, req, env)
  if (path === '/api/games/double/history' && m === 'GET') return json({ history: await doubleHistory(a, env) })
  if (path === '/api/games/double/spin' && m === 'POST') return handleDoubleSpin(a, req, env)
  return fail('NOT_FOUND', 404)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(req, env, url.pathname)
      } catch (e) {
        console.error(e)
        return fail('SERVER_ERROR', 500)
      }
    }
    return env.ASSETS.fetch(req)
  },
}
