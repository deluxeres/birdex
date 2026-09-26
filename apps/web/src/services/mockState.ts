// Создание и "тик" состояния для mock-сервера.

import { ECONOMY } from '@/config/economy'
import { STARTER_CHICKEN_KEY } from '@/config/chickens'
import { storageCapacity } from '@/economy/storage'
import { levelForXp } from '@/economy/progression'
import { currentEnergy, energyMaxForLevel } from '@/economy/energy'
import { SEASON_MS } from '@/economy/season'
import { freshModeEnergy } from '@/economy/modes'
import type { GameState } from '@/types/game'
import { getTelegramUser } from './telegram'

/** v2: 36 куриц, 15 уровней, энергия 300 + прокачка. Старые сохранения сбрасываются. */
export const SAVE_VERSION = 2

export function createNewState(now: number): GameState {
  const tg = getTelegramUser()
  const starterId = `c_${now}`
  const state: GameState = {
    profile: {
      id: tg?.id ? String(tg.id) : 'local',
      name: tg?.first_name ?? 'Фермер',
      farmName: 'Моя ферма',
      level: 1,
      xp: 0,
    },
    balance: {
      coins: ECONOMY.startCoins,
      eggs: 0,
      energy: ECONOMY.energy.start,
      energyMax: ECONOMY.energy.start,
      storageCapacity: ECONOMY.storage.start,
    },
    chickens: [{ id: starterId, key: STARTER_CHICKEN_KEY, level: 1, acquiredAt: now }],
    displayedChickenId: starterId,
    energyLevel: 0,
    storageLevel: 0,
    redeemedCodes: [],
    lastProductionAt: now,
    energyUpdatedAt: now,
    reward: { streakDay: 0, lastClaimAt: null },
    events: { channelSubscribed: false, channelBonusClaimed: false },
    season: { id: 1, points: 0, startedAt: now, endsAt: now + SEASON_MS, lastSnapshotAt: null },
    modeEnergy: freshModeEnergy(now),
    stats: { soldCoins: 0, bestPlay: 0 },
    version: SAVE_VERSION,
  }
  syncDerived(state)
  return state
}

/** Пересчитать то, что зависит от прокачки: склад и максимум энергии. */
export function syncDerived(state: GameState): void {
  state.storageLevel ??= 0 // старые сохранения без склада
  // Старые сохранения: если название уже не стандартное — бесплатную смену уже использовали.
  state.profile.renames ??= state.profile.farmName === 'Моя ферма' ? 0 : 1
  state.redeemedCodes ??= []
  state.events ??= { channelSubscribed: false, channelBonusClaimed: false }
  state.events.invite5Claimed ??= false
  state.events.invite10Claimed ??= false
  state.events.invite25Claimed ??= false
  state.events.invite100Claimed ??= false
  state.season ??= { id: 1, points: 0, startedAt: Date.now(), endsAt: Date.now() + SEASON_MS, lastSnapshotAt: null }
  if (state.season.endsAt - state.season.startedAt < SEASON_MS) {
    state.season.endsAt = state.season.startedAt + SEASON_MS
  }
  // Старые сохранения без статистики — дополняем, прогресс не сбрасывается.
  state.stats ??= { soldCoins: 0, bestPlay: 0 }
  state.stats.soldEggs ??= 0
  // Старые сохранения без режимов — энергия режимов полная.
  state.modeEnergy ??= freshModeEnergy(Date.now())
  // Новый режим Дабл — у старых сохранений энергия полная.
  state.modeEnergy.double ??= freshModeEnergy(Date.now()).double
  state.profile.level = levelForXp(state.profile.xp)
  state.balance.storageCapacity = storageCapacity(state.storageLevel)
  state.balance.energyMax = energyMaxForLevel(state.energyLevel)
}

/** Применяет восстановление энергии к состоянию. */
export function syncEnergy(state: GameState, now: number): void {
  state.balance.energy = currentEnergy({
    energy: state.balance.energy,
    energyMax: state.balance.energyMax,
    energyUpdatedAt: state.energyUpdatedAt,
    now,
  })
  state.energyUpdatedAt = now
}

/** XP = монеты, потраченные на куриц (покупка и улучшение). Уровень считается из общего XP. */
export function addXp(state: GameState, coinsSpent: number): void {
  state.profile.xp += Math.max(0, Math.round(coinsSpent))
  state.profile.level = levelForXp(state.profile.xp)
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
