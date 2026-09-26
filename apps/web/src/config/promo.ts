// Бонус-коды. Каждый код можно активировать 1 раз на игрока.
// Регистр и пробелы по краям не важны: " Prokin54 " = "prokin54".
// ⚠️ Пока бэкенда нет, коды видны в коде игры. На сервере список переедет в базу.

export interface PromoCode {
  code: string
  /** Монеты (можно не указывать). */
  coins?: number
  /** Энергия для Play. Может превысить максимум — лишнее не сгорает. */
  energy?: number
  /** Какому режиму энергия: catch — Ловля яиц (по умолчанию), fox — Лисы, run — Chicken Flight, double — Дабл. */
  energyMode?: 'catch' | 'fox' | 'run' | 'double'
}

export const PROMO_CODES: PromoCode[] = [
  { code: 'belosnezhka12', coins: 5_000 },
  { code: 'prokin54', coins: 20_000 },
  { code: 'milenatrump', coins: 100_000 },
  { code: 'rustamalban', energy: 200 },
  // Энергия отдельных режимов Play.
  { code: 'eggmoney', energy: 200, energyMode: 'catch' },
  { code: 'pantera', energy: 200, energyMode: 'fox' },
  { code: 'gustavo', energy: 200, energyMode: 'run' },
  { code: 'mark', energy: 500, energyMode: 'double' },
]

export function normalizeCode(raw: string): string {
  return raw.trim().toLowerCase()
}

export function findPromo(raw: string): PromoCode | undefined {
  const code = normalizeCode(raw)
  return PROMO_CODES.find((p) => p.code === code)
}
