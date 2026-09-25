// Бонус-коды. Каждый код можно активировать 1 раз на игрока.
// Регистр и пробелы по краям не важны: " Prokin54 " = "prokin54".
// ⚠️ Пока бэкенда нет, коды видны в коде игры. На сервере список переедет в базу.

export interface PromoCode {
  code: string
  /** Монеты (можно не указывать). */
  coins?: number
  /** Энергия для Play. Может превысить максимум — лишнее не сгорает. */
  energy?: number
}

export const PROMO_CODES: PromoCode[] = [
  { code: 'belosnezhka12', coins: 5_000 },
  { code: 'prokin54', coins: 20_000 },
  { code: 'milenatrump', coins: 100_000 },
  { code: 'rustamalban', energy: 200 },
]

export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase()
}

export function findPromo(raw: string): PromoCode | undefined {
  const code = normalizeCode(raw)
  return PROMO_CODES.find((p) => p.code === code)
}
