// Режимы Play: общие правила, энергия режимов и награды. Все числа — в ECONOMY.modes.

import { ECONOMY } from '@/config/economy'
import { currentEnergy, energyMaxForLevel, ENERGY_MAX_LEVEL } from './energy'

/** Все режимы в меню Play. puzzle и hunt пока закрыты ("скоро"). */
export type PlayMode = 'catch' | 'fox' | 'run' | 'double' | 'puzzle' | 'hunt'
/** Режимы со своей отдельной энергией (у "Ловли яиц" — основная энергия). */
export type ExtraMode = 'fox' | 'run' | 'double'

export interface ModeEnergy {
  energy: number
  updatedAt: number
  /** Уровень прокачки максимума энергии режима (0 = 300, каждый +50, до 1000). */
  level?: number
}

export const EXTRA_MODES: ExtraMode[] = ['fox', 'run', 'double']

export function modeConfig(mode: ExtraMode) {
  return ECONOMY.modes[mode]
}

/** Новая (полная) энергия режима — для новых игроков и старых сохранений. */
export function freshModeEnergy(now: number): Record<ExtraMode, ModeEnergy> {
  return {
    fox: { energy: ECONOMY.energy.start, updatedAt: now, level: 0 },
    run: { energy: ECONOMY.energy.start, updatedAt: now, level: 0 },
    double: { energy: ECONOMY.energy.start, updatedAt: now, level: 0 },
  }
}

/** Текущая энергия режима с учётом восстановления (весь максимум за refillHours). */
export function modeEnergyNow(e: ModeEnergy, now: number): number {
  return currentEnergy({ energy: e.energy, energyMax: modeEnergyMax(e), energyUpdatedAt: e.updatedAt, now })
}

/** Максимум энергии режима по его уровню прокачки. */
export function modeEnergyMax(e: ModeEnergy): number {
  return energyMaxForLevel(e.level ?? 0)
}

export function modeMaxed(e: ModeEnergy): boolean {
  return (e.level ?? 0) >= ENERGY_MAX_LEVEL
}

/** Лисы: 1 яйцо за обычную лису, 5 — за плотную. */
export function foxEggs(kills: number, tanks: number): number {
  const F = ECONOMY.modes.fox
  return kills * F.foxReward + tanks * F.tankReward
}

/** Бомбы: 20 яиц в минуту (по секундам); продержался 10 минут — главный приз 500. */
export function runEggs(seconds: number): number {
  const R = ECONOMY.modes.run
  if (seconds >= R.maxMinutes * 60) return R.winPrize
  return Math.floor((Math.max(0, seconds) * R.eggsPerMinute) / 60)
}

/** Сложность лис в момент t (с): скорость, пауза между лисами, шанс плотной. */
export function foxDifficulty(t: number) {
  const F = ECONOMY.modes.fox
  return {
    speed: Math.min(F.speedMax, F.speedStart + F.speedPerSecond * t),
    spawnGap: Math.max(F.spawnMin, F.spawnStart * F.spawnDecay ** (t / 10)),
    tankChance: F.tankChanceStart + (F.tankChanceMax - F.tankChanceStart) * Math.min(1, t / F.tankRampSeconds),
  }
}

/** Сложность бомб в момент t (с). */
export function runDifficulty(t: number) {
  const R = ECONOMY.modes.run
  return {
    spawnGap: Math.max(R.spawnMin, R.spawnStart - R.spawnPerSecond * t),
    fall: Math.min(R.fallMax, R.fallStart + R.fallPerSecond * t),
  }
}
