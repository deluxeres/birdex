// Дабл (серверная копия правил из apps/web/src/economy/double.ts — держать в синхроне).
// 38 слотов: 0 и 19 — зелёные, остальные через один красный/чёрный. Красное/чёрное x2, зелёное x14.

export type DoubleColor = 'red' | 'black' | 'green'

export const DOUBLE = {
  slots: 38,
  playCost: 30,
  minAmount: 25,
  maxAmount: 10_000,
  payout: { red: 2, black: 2, green: 14 } as Record<DoubleColor, number>,
  historyLimit: 12,
} as const

export function doubleSlotColor(slot: number): DoubleColor {
  const n = DOUBLE.slots
  const i = ((slot % n) + n) % n
  if (i === 0 || i === n / 2) return 'green'
  const k = i < n / 2 ? i : i - n / 2
  return k % 2 === 1 ? 'red' : 'black'
}

export function doubleReward(amount: number, bet: DoubleColor, landed: DoubleColor): number {
  return bet === landed ? Math.floor(amount * DOUBLE.payout[bet]) : 0
}

/** Честный случайный слот (crypto, без перекоса по модулю). */
export function randomDoubleSlot(): number {
  const limit = Math.floor(2 ** 32 / DOUBLE.slots) * DOUBLE.slots
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % DOUBLE.slots
  }
}
