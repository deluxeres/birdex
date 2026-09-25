// Календарные дни в заданном часовом поясе (по умолчанию — Вашингтон).
// Нужны для ежедневной награды: новый день = 00:00 по этому поясу.

import { ECONOMY } from '@/config/economy'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

const formatters = new Map<string, Intl.DateTimeFormat>()
function fmt(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
    formatters.set(tz, f)
  }
  return f
}

interface Parts { year: number; month: number; day: number; hour: number; minute: number; second: number }

export function zonedParts(ts: number, tz: string = ECONOMY.rewardTimeZone): Parts {
  const out: Record<string, number> = {}
  for (const p of fmt(tz).formatToParts(new Date(ts))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year, month: out.month, day: out.day,
    hour: out.hour % 24, minute: out.minute, second: out.second,
  }
}

/** Ключ дня "2026-09-25" в поясе награды. */
export function dayKey(ts: number, tz: string = ECONOMY.rewardTimeZone): string {
  const p = zonedParts(ts, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Число месяца сегодня (для календарика в шапке). */
export function dayOfMonth(ts: number, tz: string = ECONOMY.rewardTimeZone): number {
  return zonedParts(ts, tz).day
}

/** Сколько календарных дней между двумя ключами (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS)
}

/** Мс до ближайшей полуночи в поясе (учитывает переход на летнее/зимнее время). */
export function msUntilNextDay(now: number, tz: string = ECONOMY.rewardTimeZone): number {
  const p = zonedParts(now, tz)
  const elapsed = ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + (now % 1000)
  let t = now + (DAY_MS - elapsed)
  const today = dayKey(now, tz)
  if (dayKey(t, tz) === today) t += HOUR_MS // день длиной 25 ч
  else if (dayKey(t - HOUR_MS, tz) !== today) t -= HOUR_MS // день длиной 23 ч
  return Math.max(0, t - now)
}
