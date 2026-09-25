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
  created_at: number
  updated_at: number
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
]

let ready = false
export async function ensureSchema(db: D1Database): Promise<void> {
  if (ready) return
  await db.batch(SCHEMA.map((s) => db.prepare(s)))
  ready = true
}
