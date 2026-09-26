// База D1: одна таблица игроков. Схема создаётся сама при первом запросе.

export interface D1Result<T> { results: T[] }
export interface D1Stmt {
  bind(...v: unknown[]): D1Stmt
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}
export interface D1Database {
  prepare(sql: string): D1Stmt
  batch(stmts: D1Stmt[]): Promise<unknown>
}

export interface UserRow {
  id: number
  username: string | null
  first_name: string
  farm_name: string | null
  level: number
  xp: number
  chickens: number
  state: string | null
  referred_by: number | null
  coins: number
  best_play: number
  sold_total: number
  avatar: string | null
  ref_pending: number
  ref_given: number
  ref_total: number
  channel_bonus: number
  created_at: number
  updated_at: number
}

export interface ChickenFlightRow {
  id: string
  user_id: number
  amount: number
  started_at: number
  crash_at: number
  crash_multiplier: number
  status: 'FLYING' | 'COLLECTED' | 'CRASHED'
  collect_multiplier: number | null
  reward: number
  created_at: number
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT NOT NULL,
    farm_name TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    chickens INTEGER NOT NULL DEFAULT 1,
    state TEXT,
    referred_by INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS users_xp ON users (xp DESC)',
  'CREATE INDEX IF NOT EXISTS users_ref ON users (referred_by)',
  `CREATE TABLE IF NOT EXISTS chicken_flights (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    crash_at INTEGER NOT NULL,
    crash_multiplier REAL NOT NULL,
    status TEXT NOT NULL,
    collect_multiplier REAL,
    reward INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS chicken_flights_user_status ON chicken_flights (user_id, status, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS double_spins (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    bet TEXT NOT NULL,
    slot INTEGER NOT NULL,
    color TEXT NOT NULL,
    reward INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS double_spins_user ON double_spins (user_id, created_at DESC)',
]

/**
 * Новые колонки добавляются к уже существующей таблице (ALTER TABLE),
 * поэтому старые игроки и их прогресс не теряются.
 */
const COLUMNS: [string, string][] = [
  ['coins', 'INTEGER NOT NULL DEFAULT 0'], // монеты сейчас (для рейтинга)
  ['best_play', 'INTEGER NOT NULL DEFAULT 0'], // рекорд яиц за одну игру в Play
  ['sold_total', 'INTEGER NOT NULL DEFAULT 0'], // всего монет с продажи яиц (для рефералки)
  ['avatar', 'TEXT'], // ключ курицы-аватарки
  ['ref_pending', 'INTEGER NOT NULL DEFAULT 0'], // реф. монеты, ждут "Забрать"
  ['ref_given', 'INTEGER NOT NULL DEFAULT 0'], // сколько этот игрок принёс пригласившему
  ['ref_total', 'INTEGER NOT NULL DEFAULT 0'], // сколько я всего получил с друзей
  ['channel_bonus', 'INTEGER NOT NULL DEFAULT 0'], // 1 — бонус за подписку на канал уже выдан
]

let ready = false
export async function ensureSchema(db: D1Database): Promise<void> {
  if (ready) return
  await db.prepare(SCHEMA[0]).run()
  const info = await db.prepare('PRAGMA table_info(users)').all<{ name: string }>()
  const have = new Set(info.results.map((c) => c.name))
  const add = COLUMNS.filter(([name]) => !have.has(name))
  for (const [name, type] of add) {
    try {
      await db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run()
    } catch {
      /* колонку уже добавил параллельный запрос */
    }
  }
  await db.batch(
    [
      ...SCHEMA.slice(1),
      'CREATE INDEX IF NOT EXISTS users_coins ON users (coins DESC)',
      'CREATE INDEX IF NOT EXISTS users_play ON users (best_play DESC)',
    ].map((q) => db.prepare(q)),
  )
  ready = true
}
