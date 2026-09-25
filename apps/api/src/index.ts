// BIRDEX API (Cloudflare Worker + D1).
// Всё под /api/* обрабатывает этот код, остальное — статические файлы игры.
//
// Авторизация: каждый запрос несёт заголовок  Authorization: tma <initData>
// initData подписана Telegram — сервер проверяет подпись токеном бота (секрет BOT_TOKEN).
//
//   POST /api/auth         — вход; создаёт игрока, записывает реферала (startapp=ref_<id>)
//   GET  /api/state        — сохранённый прогресс
//   PUT  /api/state        — сохранить прогресс
//   GET  /api/leaderboard  — топ-50 настоящих игроков + моё место
//   GET  /api/friends      — кого я пригласил

import { verifyInitData, type TgAuth } from './telegramAuth'
import { ensureSchema, type D1Database, type UserRow } from './db'

interface Env {
  DB: D1Database
  BOT_TOKEN: string
  ASSETS: { fetch(req: Request): Promise<Response> }
}

/** Максимальный размер сохранения (защита от мусора). */
const MAX_STATE_BYTES = 64 * 1024
/** Друг считается активным, когда дорос до этого уровня. */
const ACTIVE_FRIEND_LEVEL = 2

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
  profile?: { farmName?: string; level?: number; xp?: number }
  chickens?: unknown[]
}

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
  const level = Math.max(1, Math.min(50, Math.floor(Number(state.profile?.level) || 1)))
  const xp = Math.max(0, Math.floor(Number(state.profile?.xp) || 0))
  const chickens = Array.isArray(state.chickens) ? Math.min(36, state.chickens.length) : 1
  const farmName = String(state.profile?.farmName ?? '').slice(0, 24) || null
  const res = await env.DB.prepare(
    'UPDATE users SET state = ?, level = ?, xp = ?, chickens = ?, farm_name = ?, updated_at = ? WHERE id = ?',
  )
    .bind(text, level, xp, chickens, farmName, Date.now(), a.user.id)
    .run() as { meta?: { changes?: number } }
  if (res?.meta?.changes === 0) return fail('NO_USER', 404)
  return json({ ok: true })
}

async function handleLeaderboard(a: TgAuth, env: Env): Promise<Response> {
  const top = await env.DB.prepare(
    'SELECT id, first_name, farm_name, level, xp FROM users ORDER BY xp DESC, created_at ASC LIMIT 50',
  ).all<Pick<UserRow, 'id' | 'first_name' | 'farm_name' | 'level' | 'xp'>>()
  const me = await env.DB.prepare('SELECT xp, created_at FROM users WHERE id = ?')
    .bind(a.user.id)
    .first<{ xp: number; created_at: number }>()
  const rank = me
    ? ((await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE xp > ? OR (xp = ? AND created_at < ?)')
        .bind(me.xp, me.xp, me.created_at)
        .first<{ n: number }>())?.n ?? 0) + 1
    : null
  return json({
    top: top.results.map((r, i) => ({
      rank: i + 1,
      name: r.first_name,
      farmName: r.farm_name,
      level: r.level,
      farmValue: r.xp,
      isMe: r.id === a.user.id,
    })),
    me: me ? { rank, farmValue: me.xp } : null,
  })
}

async function handleFriends(a: TgAuth, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    'SELECT id, first_name, level FROM users WHERE referred_by = ? ORDER BY created_at DESC LIMIT 200',
  )
    .bind(a.user.id)
    .all<Pick<UserRow, 'id' | 'first_name' | 'level'>>()
  return json({
    friends: rows.results.map((r) => ({
      id: String(r.id),
      name: r.first_name,
      level: r.level,
      active: r.level >= ACTIVE_FRIEND_LEVEL,
    })),
  })
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
  if (path === '/api/leaderboard' && m === 'GET') return handleLeaderboard(a, env)
  if (path === '/api/friends' && m === 'GET') return handleFriends(a, env)
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
