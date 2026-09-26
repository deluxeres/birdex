// Mock-сервер: живёт в браузере, но ведёт себя как настоящий бэкенд —
// принимает намерение, валидирует, считает результат сам.
// Когда появится apps/api, заменяется на httpApi.ts без правок в UI.

import { ECONOMY } from '@/config/economy'
import { getChickenDef } from '@/config/chickens'
import { accumulatedEggs, farmProductionPerHour } from '@/economy/production'
import { upgradeCost, isMaxLevel } from '@/economy/upgrade'
import { sellValue } from '@/economy/market'
import { rewardStatus, effectiveStreakDay, rewardAmount } from '@/economy/reward'
import { maxPlausibleEggs } from '@/economy/playDifficulty'
import { energyUpgradeCost, ENERGY_MAX_LEVEL } from '@/economy/energy'
import { storageUpgradeCost, STORAGE_MAX_LEVEL } from '@/economy/storage'
import { birdPointsForSale } from '@/economy/season'
import { modeConfig, modeEnergyNow, modeEnergyMax, modeMaxed, foxEggs, runEggs, type ExtraMode } from '@/economy/modes'
import { CHICKEN_FLIGHT, crashMultiplierForFlight, flightElapsedForMultiplier, flightMultiplierAt, flightReward } from '@/economy/chickenFlight'
import { findPromo, normalizeCode } from '@/config/promo'
import type { GameState } from '@/types/game'
import { ApiError, type ChickenFlightHistoryEntry, type DoubleHistoryEntry, type GameApi, type PlaySessionTicket } from './apiTypes'
import { doubleReward, doubleSlotColor, randomDoubleSlot } from '@/economy/double'
import { loadSave, writeSave } from './storage'
import { createNewState, syncEnergy, syncDerived, addXp, clone, SAVE_VERSION } from './mockState'
import { cloudEnabled, cloudLogin, cloudSave, cloudLeaderboard, cloudFriends, cloudClaimReferral, cloudClaimInviteTask, cloudChannelCheck, cloudChannelClaim, cloudChickenFlightActive, cloudChickenFlightCollect, cloudChickenFlightStart, cloudDoubleHistory, cloudDoubleSpin } from './cloud'
import { setSaveOwner } from './storage'
import { getTelegramUser } from './telegram'

const LATENCY_MS = 120
const wait = () => new Promise((r) => setTimeout(r, LATENCY_MS))

let state: GameState | null = null

/** Сколько стоит следующая смена названия фермы. */
export function renameCost(s: Pick<GameState, 'profile'>): number {
  return (s.profile.renames ?? 0) >= 1 ? ECONOMY.renameCost : 0
}
let activeSession: Omit<PlaySessionTicket, 'state'> | null = null
let activeMode: (Omit<PlaySessionTicket, 'state'> & { mode: ExtraMode }) | null = null
let activeFlight: {
  sessionId: string
  amount: number
  startedAt: number
  crashAt: number
  crashMultiplier: number
  settled?: boolean
} | null = null
const DOUBLE_HISTORY_KEY = 'birdex_double_history'
let doubleHistory: DoubleHistoryEntry[] = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(DOUBLE_HISTORY_KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as DoubleHistoryEntry[]) : []
  } catch {
    return []
  }
})()

/** Списать энергию режима (Chicken Flight, Дабл). Нет энергии — ошибка NO_ENERGY. */
function spendModeEnergy(s: GameState, mode: ExtraMode, now: number) {
  const e = s.modeEnergy[mode]
  const cost = modeConfig(mode).playCost
  const energy = modeEnergyNow(e, now)
  if (energy < cost) throw new ApiError('NO_ENERGY')
  s.modeEnergy[mode] = { ...e, energy: energy - cost, updatedAt: now }
}

const FLIGHT_COUNT_KEY = 'birdex_flight_count'
/** Номер следующего полёта (для правила "каждый 5-й может сгореть на 1.00x"). */
function nextFlightNumber(): number {
  let n = 0
  try {
    n = Math.floor(Number(localStorage.getItem(FLIGHT_COUNT_KEY)) || 0) + 1
    localStorage.setItem(FLIGHT_COUNT_KEY, String(n))
  } catch {
    n = Math.floor(Math.random() * 5) + 1
  }
  return n
}

const FLIGHT_HISTORY_KEY = 'birdex_flight_history'
/** История полётов хранится в localStorage, чтобы не пропадала после перезахода. */
let flightHistory: ChickenFlightHistoryEntry[] = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(FLIGHT_HISTORY_KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as ChickenFlightHistoryEntry[]) : []
  } catch {
    return []
  }
})()

let booted: Promise<void> | null = null

/** Сохранение с сервера похоже на настоящее (защита от битых/чужих данных). */
function isValidState(s: unknown): s is GameState {
  const g = s as GameState | null
  return (
    !!g &&
    g.version === SAVE_VERSION &&
    typeof g.balance?.coins === 'number' &&
    typeof g.profile?.xp === 'number' &&
    Array.isArray(g.chickens) &&
    g.chickens.length > 0 &&
    g.chickens.every((c) => typeof c?.key === 'string' && typeof c?.level === 'number')
  )
}

/**
 * Первый запуск: в Telegram входим на сервер и берём прогресс оттуда.
 * Нет сервера / не Telegram — локальное сохранение этого устройства.
 */
function boot(): Promise<void> {
  if (booted) return booted
  booted = (async () => {
    const tgUser = getTelegramUser()
    setSaveOwner(tgUser ? String(tgUser.id) : null)
    if (cloudEnabled()) {
      try {
        const res = await cloudLogin()
        if (isValidState(res.state)) {
          state = res.state
          syncDerived(state)
        }
      } catch {
        /* сервер недоступен — играем локально, сохраним позже */
      }
    }
    const s = db()
    if (tgUser) {
      s.profile.id = String(tgUser.id)
      s.profile.name = tgUser.first_name || s.profile.name
    }
    commit()
  })()
  return booted
}

function db(): GameState {
  if (!state) {
    const saved = loadSave<GameState>()
    state = isValidState(saved) ? saved : createNewState(Date.now())
    syncDerived(state)
  }
  return state
}

function commit(): GameState {
  writeSave(db())
  cloudSave(db())
  return clone(db())
}

function pushFlightHistory(entry: ChickenFlightHistoryEntry) {
  flightHistory = [entry, ...flightHistory.filter((x) => x.id !== entry.id)].slice(0, CHICKEN_FLIGHT.historyLimit)
  try {
    localStorage.setItem(FLIGHT_HISTORY_KEY, JSON.stringify(flightHistory))
  } catch {
    /* storage недоступен — история только в памяти */
  }
}

function flightStats() {
  return {
    flights: flightHistory.length,
    bestMultiplier: flightHistory.reduce((m, x) => Math.max(m, x.status === 'COLLECTED' ? x.multiplier : 0), 0),
    largestReward: flightHistory.reduce((m, x) => Math.max(m, x.reward), 0),
    totalCollected: flightHistory.reduce((m, x) => m + (x.status === 'COLLECTED' ? x.reward : 0), 0),
  }
}

function settleExpiredFlight(s: GameState, now: number) {
  if (!activeFlight || activeFlight.settled || now < activeFlight.crashAt) return
  const f = activeFlight
  activeFlight = null
  pushFlightHistory({
    id: f.sessionId,
    status: 'CRASHED',
    amount: f.amount,
    multiplier: f.crashMultiplier,
    reward: 0,
    createdAt: f.startedAt,
  })
  s.stats.bestPlay = Math.max(s.stats.bestPlay, f.amount)
}

export const mockApi: GameApi = {
  async me() {
    await boot()
    await wait()
    syncDerived(db())
    syncEnergy(db(), Date.now())
    return commit()
  },

  async collect() {
    await wait()
    const s = db()
    const now = Date.now()
    const collected = accumulatedEggs({
      perHour: farmProductionPerHour(s.chickens),
      lastProductionAt: s.lastProductionAt,
      now,
      eggsInStorage: s.balance.eggs,
      storageCapacity: s.balance.storageCapacity,
    })
    s.balance.eggs += collected
    s.lastProductionAt = now
    return { collected, state: commit() }
  },

  async sellEggs(amount) {
    await wait()
    const s = db()
    const eggs = Math.floor(amount)
    if (eggs <= 0) throw new ApiError('BAD_AMOUNT')
    if (eggs > s.balance.eggs) throw new ApiError('NOT_ENOUGH_EGGS')
    const coins = sellValue(eggs)
    s.balance.eggs -= eggs
    s.balance.coins += coins
    s.stats.soldCoins += coins // с этого пригласившему идёт 12%
    // BIRD Points: 1 за каждые 100 проданных яиц (остаток копится).
    const soldBefore = s.stats.soldEggs ?? 0
    s.stats.soldEggs = soldBefore + eggs
    const birdPointsAwarded = birdPointsForSale(soldBefore, s.stats.soldEggs)
    s.season.points += birdPointsAwarded
    return { eggsSold: eggs, coinsReceived: coins, birdPointsAwarded, state: commit() }
  },

  async buyChicken(key) {
    await wait()
    const s = db()
    const def = getChickenDef(key)
    if (s.chickens.some((c) => c.key === key)) throw new ApiError('ALREADY_OWNED')
    if (s.balance.coins < def.price) throw new ApiError('NOT_ENOUGH_COINS')
    // Сначала собираем накопленное по старой ставке.
    await mockApi.collect()
    s.balance.coins -= def.price
    s.chickens.push({ id: `c_${Date.now()}`, key, level: 1, acquiredAt: Date.now() })
    syncDerived(s)
    addXp(s, def.price)
    return commit()
  },

  async upgradeChicken(chickenId) {
    await wait()
    const s = db()
    const chicken = s.chickens.find((c) => c.id === chickenId)
    if (!chicken) throw new ApiError('NOT_FOUND')
    if (isMaxLevel(chicken.key, chicken.level)) throw new ApiError('MAX_LEVEL')
    const cost = upgradeCost(chicken.key, chicken.level)
    if (s.balance.coins < cost) throw new ApiError('NOT_ENOUGH_COINS')
    // Сначала собираем накопленное по старой ставке, чтобы не потерять/не удвоить яйца.
    await mockApi.collect()
    s.balance.coins -= cost
    chicken.level += 1
    syncDerived(s)
    addXp(s, cost)
    return commit()
  },

  async upgradeEnergy() {
    await wait()
    const s = db()
    if (s.energyLevel >= ENERGY_MAX_LEVEL) throw new ApiError('MAX_LEVEL')
    const cost = energyUpgradeCost(s.energyLevel)
    if (s.balance.coins < cost) throw new ApiError('NOT_ENOUGH_COINS')
    syncEnergy(s, Date.now())
    s.balance.coins -= cost
    s.energyLevel += 1
    syncDerived(s)
    // +50 к максимуму сразу добавляет и +50 к текущей энергии
    // бонусная энергия сверх максимума не срезается
    s.balance.energy = Math.max(s.balance.energy, Math.min(s.balance.energyMax, s.balance.energy + ECONOMY.energy.upgradeStep))
    return commit()
  },

  /** Прокачка энергии режима Лисы / Бомбы: +50 к максимуму (и к текущей), цены как у основной. */
  async upgradeModeEnergy(mode) {
    await wait()
    const s = db()
    const e = s.modeEnergy[mode]
    if (modeMaxed(e)) throw new ApiError('MAX_LEVEL')
    const level = e.level ?? 0
    const cost = energyUpgradeCost(level)
    if (s.balance.coins < cost) throw new ApiError('NOT_ENOUGH_COINS')
    const now = Date.now()
    const cur = modeEnergyNow(e, now)
    s.balance.coins -= cost
    const next = { energy: cur, updatedAt: now, level: level + 1 }
    next.energy = Math.max(cur, Math.min(modeEnergyMax(next), cur + ECONOMY.energy.upgradeStep))
    s.modeEnergy[mode] = next
    return commit()
  },

  async upgradeStorage() {
    await wait()
    const s = db()
    if (s.storageLevel >= STORAGE_MAX_LEVEL) throw new ApiError('MAX_LEVEL')
    const cost = storageUpgradeCost(s.storageLevel)
    if (s.balance.coins < cost) throw new ApiError('NOT_ENOUGH_COINS')
    // Сначала собираем то, что упёрлось в старый склад.
    await mockApi.collect()
    s.balance.coins -= cost
    s.storageLevel += 1
    syncDerived(s)
    return commit()
  },

  async redeemCode(raw) {
    await wait()
    const s = db()
    const promo = findPromo(raw)
    if (!promo) throw new ApiError('CODE_INVALID')
    const code = normalizeCode(raw)
    if (s.redeemedCodes.includes(code)) throw new ApiError('CODE_USED')
    s.redeemedCodes.push(code)
    const coins = promo.coins ?? 0
    const energy = promo.energy ?? 0
    const energyMode = promo.energyMode ?? 'catch'
    s.balance.coins += coins
    if (energy > 0 && energyMode === 'catch') {
      syncEnergy(s, Date.now())
      s.balance.energy += energy
    } else if (energy > 0 && energyMode !== 'catch') {
      // Энергия Лис / Бомб: может быть выше максимума, лишнее не сгорает.
      const now = Date.now()
      const e = s.modeEnergy[energyMode]
      s.modeEnergy[energyMode] = { ...e, energy: modeEnergyNow(e, now) + energy, updatedAt: now }
    }
    return { coins, energy, energyMode, state: commit() }
  },

  async displayChicken(chickenId) {
    await wait()
    const s = db()
    if (!s.chickens.some((c) => c.id === chickenId)) throw new ApiError('NOT_FOUND')
    s.displayedChickenId = chickenId
    return commit()
  },

  async claimReward() {
    await wait()
    const s = db()
    const now = Date.now()
    if (rewardStatus(s.reward, now) !== 'ready') throw new ApiError('REWARD_NOT_READY')
    const day = effectiveStreakDay(s.reward, now)
    const coins = rewardAmount(day)
    s.balance.coins += coins
    s.reward = { streakDay: (day + 1) % ECONOMY.rewardStreak.length, lastClaimAt: now }
    return { coins, day, state: commit() }
  },

  async startPlay() {
    await wait()
    const s = db()
    const now = Date.now()
    syncEnergy(s, now)
    if (s.balance.energy < ECONOMY.energy.playCost) throw new ApiError('NO_ENERGY')
    // Энергия списывается сразу за попытку (50% стартового запаса).
    s.balance.energy -= ECONOMY.energy.playCost
    activeSession = {
      sessionId: `s_${now}`,
      startedAt: now,
      expiresAt: now + ECONOMY.play.maxSessionMinutes * 60_000,
    }
    return { ...activeSession, state: commit() }
  },

  async finishPlay(summary) {
    await wait()
    const s = db()
    const session = activeSession
    if (!session || session.sessionId !== summary.sessionId) throw new ApiError('BAD_SESSION')
    activeSession = null // идемпотентность: второй finish той же сессии не пройдёт
    const now = Date.now()
    const duration = Math.min(now, session.expiresAt) - session.startedAt
    const caught = summary.normalCaught + summary.goldenCaught
    const plausible = maxPlausibleEggs(duration)
    const ratio = caught > 0 ? Math.min(1, plausible / caught) : 0
    const maxEarned = summary.normalCaught * 2 + summary.goldenCaught * ECONOMY.play.goldenReward
    const raw = Math.max(0, Math.min(Math.floor(summary.eggsEarned), maxEarned))
    const free = Math.max(0, s.balance.storageCapacity - s.balance.eggs)
    const earned = Math.floor(raw * ratio)
    const eggsAwarded = Math.max(0, Math.min(earned, free))
    s.balance.eggs += eggsAwarded
    // Рекорд для рейтинга — сколько набил за игру (даже если склад не вместил).
    s.stats.bestPlay = Math.max(s.stats.bestPlay, earned)
    return { eggsAwarded, state: commit() }
  },

  // ── Режимы Лисы и Бомбы: своя энергия, награда считается здесь ("сервер") ──
  async startMode(mode) {
    await wait()
    const s = db()
    const now = Date.now()
    const cfg = modeConfig(mode)
    const e = s.modeEnergy[mode]
    const energy = modeEnergyNow(e, now)
    if (energy < cfg.playCost) throw new ApiError('NO_ENERGY')
    s.modeEnergy[mode] = { ...e, energy: energy - cfg.playCost, updatedAt: now }
    activeMode = {
      mode,
      sessionId: `m_${now}`,
      startedAt: now,
      expiresAt: now + (ECONOMY.modes.run.maxMinutes + 2) * 60_000,
    }
    return { sessionId: activeMode.sessionId, startedAt: now, expiresAt: activeMode.expiresAt, state: commit() }
  },

  async finishMode(summary) {
    await wait()
    const s = db()
    const session = activeMode
    if (!session || session.sessionId !== summary.sessionId || session.mode !== summary.mode) throw new ApiError('BAD_SESSION')
    activeMode = null
    const seconds = (Math.min(Date.now(), session.expiresAt) - session.startedAt) / 1000
    let earned = 0
    if (session.mode === 'fox') {
      // Анти-чит: убийств не больше, чем физически успеть за время игры.
      const cap = Math.ceil(seconds * ECONOMY.modes.fox.maxKillsPerSecond)
      const kills = Math.max(0, Math.min(Math.floor(summary.kills ?? 0), cap))
      const tanks = Math.max(0, Math.min(Math.floor(summary.tanks ?? 0), Math.ceil(cap / ECONOMY.modes.fox.tankHits)))
      earned = foxEggs(kills, tanks)
    } else {
      // Прожил не дольше, чем реально длилась попытка.
      earned = runEggs(Math.min(Math.max(0, summary.seconds ?? 0), seconds + 1))
    }
    const free = Math.max(0, s.balance.storageCapacity - s.balance.eggs)
    const eggsAwarded = Math.min(earned, free)
    s.balance.eggs += eggsAwarded
    s.stats.bestPlay = Math.max(s.stats.bestPlay, earned)
    return { eggsAwarded, state: commit() }
  },

  async chickenFlightActive() {
    await boot()
    if (cloudEnabled()) {
      const res = await cloudChickenFlightActive()
      state = res.state
      syncDerived(state)
      writeSave(state)
      return res
    }
    await wait()
    const s = db()
    settleExpiredFlight(s, Date.now())
    return {
      session: activeFlight
        ? {
            sessionId: activeFlight.sessionId,
            amount: activeFlight.amount,
            startedAt: activeFlight.startedAt,
            status: 'FLYING',
            state: commit(),
          }
        : null,
      history: flightHistory,
      stats: flightStats(),
      state: commit(),
    }
  },

  async chickenFlightStart(rawAmount) {
    await boot()
    if (cloudEnabled()) {
      const res = await cloudChickenFlightStart(rawAmount)
      state = res.state
      syncDerived(state)
      writeSave(state)
      return res
    }
    await wait()
    const s = db()
    const now = Date.now()
    settleExpiredFlight(s, now)
    if (activeFlight) throw new ApiError('FLIGHT_ACTIVE')
    const amount = Math.floor(Number(rawAmount))
    if (!Number.isFinite(amount) || amount < CHICKEN_FLIGHT.minAmount || amount > CHICKEN_FLIGHT.maxAmount) throw new ApiError('BAD_AMOUNT')
    if (amount > s.balance.eggs) throw new ApiError('NOT_ENOUGH_EGGS')
    spendModeEnergy(s, 'run', now)
    const crashMultiplier = crashMultiplierForFlight(nextFlightNumber())
    s.balance.eggs -= amount
    activeFlight = {
      sessionId: `cf_${now}`,
      amount,
      startedAt: now,
      crashAt: now + flightElapsedForMultiplier(crashMultiplier),
      crashMultiplier,
    }
    return { sessionId: activeFlight.sessionId, amount, startedAt: now, status: 'FLYING', state: commit() }
  },

  async chickenFlightCollect(sessionId) {
    await boot()
    if (cloudEnabled()) {
      const res = await cloudChickenFlightCollect(sessionId)
      state = res.state
      syncDerived(state)
      writeSave(state)
      return res
    }
    await wait()
    const s = db()
    const f = activeFlight
    if (!f || f.sessionId !== sessionId || f.settled) throw new ApiError('BAD_SESSION')
    f.settled = true
    activeFlight = null
    const now = Date.now()
    const crashed = now >= f.crashAt
    const multiplier = crashed ? f.crashMultiplier : flightMultiplierAt(now - f.startedAt)
    const reward = crashed ? 0 : flightReward(f.amount, multiplier)
    if (!crashed) s.balance.eggs += reward
    s.stats.bestPlay = Math.max(s.stats.bestPlay, reward || f.amount)
    const entry: ChickenFlightHistoryEntry = {
      id: f.sessionId,
      status: crashed ? 'CRASHED' : 'COLLECTED',
      amount: f.amount,
      multiplier,
      reward,
      createdAt: f.startedAt,
    }
    pushFlightHistory(entry)
    return {
      success: !crashed,
      status: entry.status,
      multiplier,
      reward,
      amount: f.amount,
      state: commit(),
      history: flightHistory,
    }
  },

  async doubleHistory() {
    await boot()
    if (cloudEnabled()) return cloudDoubleHistory()
    return { history: doubleHistory }
  },

  async doubleSpin(rawAmount, bet) {
    await boot()
    if (cloudEnabled()) {
      const res = await cloudDoubleSpin(rawAmount, bet)
      state = res.state
      syncDerived(state)
      writeSave(state)
      return res
    }
    await wait()
    const s = db()
    const now = Date.now()
    const D = ECONOMY.modes.double
    const amount = Math.floor(Number(rawAmount))
    if (!Number.isFinite(amount) || amount < D.minAmount || amount > D.maxAmount) throw new ApiError('BAD_AMOUNT')
    if (bet !== 'red' && bet !== 'black' && bet !== 'green') throw new ApiError('BAD_BET')
    if (amount > s.balance.eggs) throw new ApiError('NOT_ENOUGH_EGGS')
    spendModeEnergy(s, 'double', now)
    const slot = randomDoubleSlot(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32)
    const color = doubleSlotColor(slot)
    const reward = doubleReward(amount, bet, color)
    s.balance.eggs += reward - amount
    s.stats.bestPlay = Math.max(s.stats.bestPlay, reward)
    const entry: DoubleHistoryEntry = { id: `db_${now}`, bet, slot, color, amount, reward, createdAt: now }
    doubleHistory = [entry, ...doubleHistory].slice(0, D.historyLimit)
    try {
      localStorage.setItem(DOUBLE_HISTORY_KEY, JSON.stringify(doubleHistory))
    } catch {
      /* только в памяти */
    }
    return { id: entry.id, slot, color, win: reward > 0, amount, bet, reward, state: commit(), history: doubleHistory }
  },

  async leaderboard(kind) {
    if (!cloudEnabled()) return { top: [], me: null, online: false }
    const res = await cloudLeaderboard(kind)
    return { ...res, online: true }
  },

  async friends() {
    if (!cloudEnabled()) return { friends: [], pending: 0, total: 0, online: false }
    return { ...(await cloudFriends()), online: true }
  },

  async claimReferral() {
    if (!cloudEnabled()) throw new ApiError('OFFLINE')
    const coins = await cloudClaimReferral()
    const s = db()
    s.balance.coins += coins // не считается продажей — 12% с 12% не бывает
    return { coins, state: commit() }
  },

  async claimInviteTask(target) {
    const s = db()
    if (cloudEnabled()) {
      const res = await cloudClaimInviteTask(target)
      state = res.state
      syncDerived(state)
      writeSave(state)
      return res
    }
    await wait()
    const key = target === 5 ? 'invite5Claimed' : target === 10 ? 'invite10Claimed' : target === 25 ? 'invite25Claimed' : 'invite100Claimed'
    if (s.events[key]) throw new ApiError('BONUS_CLAIMED')
    // В обычном браузере рефералы проверить нельзя, поэтому задача честно недоступна.
    throw new ApiError('OFFLINE')
  },

  // Подписку на канал проверяет сервер (спрашивает Telegram), он же выдаёт бонус один раз.
  // Вне Telegram (обычный браузер) — упрощённая проверка для теста.
  async verifyChannelSubscription() {
    const s = db()
    if (cloudEnabled()) {
      const res = await cloudChannelCheck()
      s.events.channelSubscribed = res.subscribed
      if (res.claimed) s.events.channelBonusClaimed = true
      commit()
      if (!res.subscribed) throw new ApiError('CHANNEL_NOT_SUBSCRIBED')
      return { subscribed: true, state: clone(s) }
    }
    await wait()
    s.events.channelSubscribed = true
    return { subscribed: true, state: commit() }
  },

  async claimChannelBonus() {
    const s = db()
    if (s.events.channelBonusClaimed) throw new ApiError('CHANNEL_BONUS_CLAIMED')
    let coins = 1000
    if (cloudEnabled()) {
      try {
        coins = (await cloudChannelClaim()).coins
      } catch (e) {
        // Сервер говорит "уже забран" — запоминаем, чтобы кнопка больше не предлагала.
        if (e instanceof ApiError && e.code === 'CHANNEL_BONUS_CLAIMED') {
          s.events.channelBonusClaimed = true
          commit()
        }
        if (e instanceof ApiError && e.code === 'CHANNEL_NOT_SUBSCRIBED') {
          s.events.channelSubscribed = false
          commit()
        }
        throw e
      }
    } else {
      await wait()
      if (!s.events.channelSubscribed) throw new ApiError('CHANNEL_NOT_SUBSCRIBED')
    }
    s.events.channelBonusClaimed = true
    s.balance.coins += coins
    return { coins, state: commit() }
  },

  async renameFarm(name) {
    await wait()
    const clean = name.trim().slice(0, 24)
    if (!clean) throw new ApiError('BAD_NAME')
    const s = db()
    if (clean === s.profile.farmName) return commit() // то же имя — ничего не списываем
    // Первая смена бесплатная, дальше — ECONOMY.renameCost монет.
    const cost = renameCost(s)
    if (s.balance.coins < cost) throw new ApiError('NOT_ENOUGH_COINS')
    s.balance.coins -= cost
    s.profile.farmName = clean
    s.profile.renames = (s.profile.renames ?? 0) + 1
    return commit()
  },
}
