import { ECONOMY } from '@/config/economy'
import { getChickenDef } from '@/config/chickens'
import type { OwnedChicken } from '@/types/game'

const HOUR_MS = 3_600_000

/** Производство одной курицы (яиц/час) на заданном уровне. */
export function chickenProduction(key: string, level: number): number {
  const def = getChickenDef(key)
  return Math.round(def.baseProductionPerHour * ECONOMY.productionGrowth ** (level - 1))
}

/** Суммарное производство фермы (яиц/час). */
export function farmProductionPerHour(chickens: OwnedChicken[], multiplier = 1): number {
  const sum = chickens.reduce((acc, c) => acc + chickenProduction(c.key, c.level), 0)
  return Math.floor(sum * multiplier)
}

/**
 * Сколько яиц накопилось с lastProductionAt.
 * Учитывает оффлайн-кап и свободное место на складе.
 */
export function accumulatedEggs(params: {
  perHour: number
  lastProductionAt: number
  now: number
  eggsInStorage: number
  storageCapacity: number
}): number {
  const { perHour, lastProductionAt, now, eggsInStorage, storageCapacity } = params
  const capMs = ECONOMY.offlineCapHours * HOUR_MS
  const elapsed = Math.max(0, Math.min(now - lastProductionAt, capMs))
  const produced = Math.floor((perHour * elapsed) / HOUR_MS)
  const free = Math.max(0, storageCapacity - eggsInStorage)
  return Math.min(produced, free)
}
