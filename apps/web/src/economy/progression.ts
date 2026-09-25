// Прогресс игрока: уровень по потраченным монетам и "типичная ферма" на уровне.
// Типичная ферма считается симуляцией разумного игрока: он всегда покупает то,
// что быстрее окупается (новая курица или улучшение). Считается 1 раз и кешируется.

import { ECONOMY } from '@/config/economy'
import { CHICKENS } from '@/config/chickens'
import { chickenProduction } from './production'
import { upgradeCost } from './upgrade'

interface Point { spent: number; perHour: number }

let curve: Point[] | null = null
let growth = 0

function build(): Point[] {
  const levels = CHICKENS.map((_, i) => (i === 0 ? 1 : 0))
  let spent = 0
  const out: Point[] = [{ spent: 0, perHour: chickenProduction(CHICKENS[0].key, 1) }]
  const farm = () => CHICKENS.reduce((a, c, i) => a + (levels[i] ? chickenProduction(c.key, levels[i]) : 0), 0)
  for (;;) {
    let best = -1
    let bestRatio = Infinity
    let bestCost = 0
    const next = levels.indexOf(0)
    if (next >= 0) {
      const c = CHICKENS[next]
      best = next
      bestCost = c.price
      bestRatio = c.price / chickenProduction(c.key, 1)
    }
    CHICKENS.forEach((c, i) => {
      const l = levels[i]
      if (l < 1 || l >= c.maxLevel) return
      const cost = upgradeCost(c.key, l)
      const ratio = cost / (chickenProduction(c.key, l + 1) - chickenProduction(c.key, l))
      if (ratio < bestRatio) {
        bestRatio = ratio
        best = i
        bestCost = cost
      }
    })
    if (best < 0) break
    levels[best] += 1
    spent += bestCost
    out.push({ spent, perHour: farm() })
  }
  return out
}

function getCurve(): Point[] {
  if (!curve) {
    curve = build()
    const total = curve[curve.length - 1].spent
    growth = (total / ECONOMY.player.level2Xp) ** (1 / (ECONOMY.player.maxLevel - 2))
  }
  return curve
}

/** Сколько XP (потраченных монет) нужно для уровня. */
export function xpForLevel(level: number): number {
  getCurve()
  if (level <= 1) return 0
  return Math.round(ECONOMY.player.level2Xp * growth ** (level - 2))
}

export function levelForXp(xp: number): number {
  let l = 1
  while (l < ECONOMY.player.maxLevel && xp >= xpForLevel(l + 1)) l++
  return l
}

/** Прогресс внутри уровня 0..1 (для полоски под именем). */
export function levelProgress(xp: number): number {
  const l = levelForXp(xp)
  if (l >= ECONOMY.player.maxLevel) return 1
  const from = xpForLevel(l)
  return (xp - from) / (xpForLevel(l + 1) - from)
}

/** Типичная ферма (яиц/ч) у игрока, потратившего столько монет. */
export function referencePerHour(spent: number): number {
  const c = getCurve()
  let ph = c[0].perHour
  for (const p of c) {
    if (p.spent > spent) break
    ph = p.perHour
  }
  return ph
}

const valueCache = new Map<number, number>()

/**
 * Сколько яиц даёт одно пойманное яйцо в Play на этом уровне игрока.
 * Ур. 1–10 — из таблицы earlyLevels, дальше формула, но всегда минимум +1 к прошлому уровню.
 */
export function playEggValue(level: number): number {
  const V = ECONOMY.playValue
  const early = V.earlyLevels
  if (level <= early.length) return early[Math.max(0, level - 1)]
  const cached = valueCache.get(level)
  if (cached) return cached
  const formula = Math.round((referencePerHour(xpForLevel(level)) * V.lag) / V.baselinePerHour)
  const value = Math.max(formula, playEggValue(level - 1) + 1)
  valueCache.set(level, value)
  return value
}
