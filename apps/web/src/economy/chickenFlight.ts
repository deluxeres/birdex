export type FlightMilestone = {
  at: number
  label: string
}

export type FlightZone = 'farm' | 'sky' | 'clouds' | 'space' | 'moon' | 'deep'

export const CHICKEN_FLIGHT = {
  minAmount: 25,
  maxAmount: 10_000,
  presets: [25, 50, 100, 250],
  maxMultiplier: 75,
  curvePower: 1.42,
  curveScale: 0.026,
  historyLimit: 8,
  /** Каждый 5-й полёт с шансом 30% — мгновенный краш на 1.00x (всё сгорает). */
  instantCrashEvery: 5,
  instantCrashChance: 0.3,
  milestones: [
    { at: 2, label: 'BOOST!' },
    { at: 5, label: 'CLOUD BREAK!' },
    { at: 10, label: 'SPACE!' },
    { at: 25, label: 'TO THE MOON!' },
    { at: 50, label: 'LEGENDARY FLIGHT!' },
  ] satisfies FlightMilestone[],
} as const

export function flightMultiplierAt(elapsedMs: number): number {
  const seconds = Math.max(0, elapsedMs) / 1000
  const raw = 1 + CHICKEN_FLIGHT.curveScale * seconds ** CHICKEN_FLIGHT.curvePower
  return Math.min(CHICKEN_FLIGHT.maxMultiplier, Math.floor(raw * 100) / 100)
}

export function flightElapsedForMultiplier(multiplier: number): number {
  const m = Math.max(1, Math.min(CHICKEN_FLIGHT.maxMultiplier, multiplier))
  return Math.round(((m - 1) / CHICKEN_FLIGHT.curveScale) ** (1 / CHICKEN_FLIGHT.curvePower) * 1000)
}

export function flightReward(amount: number, multiplier: number): number {
  return Math.floor(Math.max(0, amount) * Math.max(1, multiplier))
}

export function flightZone(multiplier: number): FlightZone {
  if (multiplier >= 50) return 'deep'
  if (multiplier >= 25) return 'moon'
  if (multiplier >= 10) return 'space'
  if (multiplier >= 5) return 'clouds'
  if (multiplier >= 2) return 'sky'
  return 'farm'
}

export function randomCrashMultiplier(rand = Math.random()): number {
  const r = Math.min(0.999999, Math.max(0.000001, rand))
  const base = 1 / (1 - r * 0.965)
  const capped = Math.min(CHICKEN_FLIGHT.maxMultiplier, Math.max(1.08, base))
  return Math.floor(capped * 100) / 100
}

/** Множитель краша для полёта номер flightNumber (1, 2, 3…): каждый 5-й может сгореть сразу на 1.00x. */
export function crashMultiplierForFlight(flightNumber: number, rand = Math.random, randInstant = Math.random): number {
  if (flightNumber > 0 && flightNumber % CHICKEN_FLIGHT.instantCrashEvery === 0 && randInstant() < CHICKEN_FLIGHT.instantCrashChance) return 1
  return randomCrashMultiplier(rand())
}
