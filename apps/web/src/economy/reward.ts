// Ежедневная награда: 1 раз за календарный день (по ECONOMY.rewardTimeZone).
// Серия 7 дней. Пропустил день — серия сбрасывается на День 1.

import { ECONOMY } from '@/config/economy'
import type { RewardState } from '@/types/game'
import { dayKey, daysBetween, msUntilNextDay } from './dayClock'

export type RewardStatus = 'ready' | 'wait'

export function rewardStatus(state: RewardState, now: number): RewardStatus {
  if (state.lastClaimAt === null) return 'ready'
  return dayKey(state.lastClaimAt) === dayKey(now) ? 'wait' : 'ready'
}

/** Сколько мс до следующей награды (0 — можно забрать сейчас). */
export function msUntilReward(state: RewardState, now: number): number {
  return rewardStatus(state, now) === 'ready' ? 0 : msUntilNextDay(now)
}

/**
 * Индекс дня серии (0..6), который будет выдан / показан как текущий.
 * Забирал вчера → серия продолжается. Пропустил хотя бы день → с начала.
 */
export function effectiveStreakDay(state: RewardState, now: number): number {
  if (state.lastClaimAt === null) return 0
  const gap = daysBetween(dayKey(state.lastClaimAt), dayKey(now))
  if (gap > 1 && ECONOMY.rewardResetOnMiss) return 0
  // Серия была длиннее (старый календарь на 30 дней) — продолжаем по кругу.
  return state.streakDay % ECONOMY.rewardStreak.length
}

export function rewardAmount(day: number): number {
  const list = ECONOMY.rewardStreak
  return list[Math.min(day, list.length - 1)]
}
