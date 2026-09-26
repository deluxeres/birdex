// Дабл: барабан из 38 слотов. Сверху (слот 0) и снизу (слот 19) — зелёные,
// остальные через один красный / чёрный (по 18 штук). Красное и чёрное — x2, зелёное — x14.
import { ECONOMY } from '@/config/economy'

export type DoubleColor = 'red' | 'black' | 'green'

export const DOUBLE_SLOTS = 38
export const DOUBLE_GREEN_SLOTS = [0, DOUBLE_SLOTS / 2] as const

/** Цвет слота по номеру (0 — верх барабана, дальше по часовой). */
export function doubleSlotColor(slot: number): DoubleColor {
  const i = ((slot % DOUBLE_SLOTS) + DOUBLE_SLOTS) % DOUBLE_SLOTS
  if (i === 0 || i === DOUBLE_SLOTS / 2) return 'green'
  const k = i < DOUBLE_SLOTS / 2 ? i : i - DOUBLE_SLOTS / 2
  return k % 2 === 1 ? 'red' : 'black'
}

export const DOUBLE_LAYOUT: DoubleColor[] = Array.from({ length: DOUBLE_SLOTS }, (_, i) => doubleSlotColor(i))

/** Выплата: ставка × множитель цвета, если угадал; иначе 0. */
export function doubleReward(amount: number, bet: DoubleColor, landed: DoubleColor): number {
  return bet === landed ? Math.floor(amount * ECONOMY.modes.double.payout[bet]) : 0
}

/** Случайный слот (равномерно). rand — число 0..1. */
export function randomDoubleSlot(rand = Math.random()): number {
  return Math.min(DOUBLE_SLOTS - 1, Math.floor(Math.max(0, rand) * DOUBLE_SLOTS))
}
