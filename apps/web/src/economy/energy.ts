// Энергия для Play: максимум прокачивается за монеты, восполняется за 8 часов.

import { ECONOMY } from '@/config/economy'
import { niceRound } from './round'

const E = ECONOMY.energy
const HOUR_MS = 3_600_000

/** Максимум энергии на уровне прокачки (0 = старт 300). */
export function energyMaxForLevel(level: number): number {
  return Math.min(E.max, E.start + level * E.upgradeStep)
}

/** Сколько всего улучшений энергии (300 → 1000 по +50 = 14). */
export const ENERGY_MAX_LEVEL = Math.ceil((E.max - E.start) / E.upgradeStep)

/** Цена улучшения энергии с уровня level на level+1. */
export function energyUpgradeCost(level: number): number {
  return niceRound(E.upgradeBaseCost * E.upgradeGrowth ** level)
}

/** Энергии в секунду: весь максимум за refillHours. */
export function energyRegenPerSecond(energyMax: number): number {
  return energyMax / ((E.refillHours * HOUR_MS) / 1000)
}

/** Текущая энергия с учётом восстановления. */
export function currentEnergy(params: {
  energy: number
  energyMax: number
  energyUpdatedAt: number
  now: number
}): number {
  const { energy, energyMax, energyUpdatedAt, now } = params
  // Сверх максимума (бонус-код) — не восстанавливается и не срезается.
  if (energy >= energyMax) return Math.floor(energy)
  const regen = (Math.max(0, now - energyUpdatedAt) / 1000) * energyRegenPerSecond(energyMax)
  return Math.min(energyMax, Math.floor(energy + regen))
}

/** Мс до следующей полной попытки (0 — можно играть). */
export function msUntilPlayable(energy: number, energyMax: number): number {
  const need = E.playCost - energy
  if (need <= 0) return 0
  return Math.ceil((need / energyRegenPerSecond(energyMax)) * 1000)
}
