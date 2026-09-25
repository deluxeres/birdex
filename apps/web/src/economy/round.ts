/** Красивое округление до 2 значащих цифр: 1234 → 1200, 56789 → 57000. Меньше 1000 — до десятков. */
export function niceRound(x: number): number {
  if (x < 100) return Math.round(x)
  const d = x < 1000 ? 10 : 10 ** (Math.floor(Math.log10(x)) - 1)
  return Math.round(x / d) * d
}
