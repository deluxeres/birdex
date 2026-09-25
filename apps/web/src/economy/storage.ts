// Склад яиц: вместимость по уровню и цена улучшения.

import { ECONOMY } from '@/config/economy'
import { niceRound } from './round'

const S = ECONOMY.storage
/** Последний уровень (0 = старт 1 000). */
export const STORAGE_MAX_LEVEL = S.levels - 1
const GROWTH = (S.max / S.start) ** (1 / STORAGE_MAX_LEVEL)

export function storageCapacity(level: number): number {
  const L = Math.max(0, Math.min(level, STORAGE_MAX_LEVEL))
  if (L === STORAGE_MAX_LEVEL) return S.max
  return niceRound(S.start * GROWTH ** L)
}

/** Цена улучшения склада с уровня level на level+1. */
export function storageUpgradeCost(level: number): number {
  return niceRound(storageCapacity(level + 1) * S.costPerEgg * S.costGrowth ** level)
}
