// Энергия режимов Play на сервере (копия формул из apps/web/src/economy/energy.ts).
// Максимум = 300 + 50 × уровень (до 1000), весь максимум восстанавливается за 8 часов.

export interface ModeEnergy { energy?: number; updatedAt?: number; level?: number }

const START = 300
const STEP = 50
const MAX = 1000
const REFILL_MS = 8 * 3_600_000

export function modeEnergyMax(e: ModeEnergy | undefined): number {
  return Math.min(MAX, START + Math.max(0, Math.floor(Number(e?.level) || 0)) * STEP)
}

/** Текущая энергия. Нет записи о режиме (старое сохранение) — энергия полная. */
export function modeEnergyNow(e: ModeEnergy | undefined, now: number): number {
  const max = modeEnergyMax(e)
  if (!e || typeof e.energy !== 'number') return max
  if (e.energy >= max) return Math.floor(e.energy)
  const regen = (Math.max(0, now - (Number(e.updatedAt) || now)) / REFILL_MS) * max
  return Math.min(max, Math.floor(e.energy + regen))
}

/** Списать cost энергии режима. false — не хватает. */
export function spendModeEnergy(
  state: { modeEnergy?: Record<string, ModeEnergy> },
  mode: string,
  cost: number,
  now: number,
): boolean {
  const e = state.modeEnergy?.[mode]
  const cur = modeEnergyNow(e, now)
  if (cur < cost) return false
  state.modeEnergy = { ...(state.modeEnergy ?? {}), [mode]: { ...(e ?? {}), level: e?.level ?? 0, energy: cur - cost, updatedAt: now } }
  return true
}
