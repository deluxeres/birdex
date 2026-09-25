// Сложность Play: с каждым пойманным яйцом яйца падают чаще и быстрее.

import { ECONOMY } from '@/config/economy'

const P = ECONOMY.play

/** Интервал между появлением яиц, мс. */
export function spawnIntervalMs(caught: number): number {
  const perSecond = Math.min(P.spawnMax, P.spawnStart + caught * P.spawnPerEgg)
  return 1000 / perSecond
}

/** Сколько мс яйцо падает до низа экрана. */
export function fallDurationMs(caught: number): number {
  return Math.max(P.fallMinMs, P.fallStartMs - caught * P.fallPerEggMs)
}

/** Анти-чит: максимум яиц, которые реально поймать за попытку данной длины. */
export function maxPlausibleEggs(durationMs: number): number {
  return Math.ceil((durationMs / 1000) * P.maxEggsPerSecond)
}
