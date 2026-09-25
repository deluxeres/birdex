// Общие типы игры. Позже переедут в packages/shared, когда появится бэкенд.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type TabId = 'farm' | 'play' | 'chickens' | 'market' | 'shop' | 'events'

export type SheetId = 'reward' | 'rating' | 'friends' | 'settings' | 'chickenPicker' | null

/** Статическое описание породы курицы (конфиг, не данные игрока). */
export interface ChickenDefinition {
  /** Порядковый номер 1..36 (страница = ceil(n / 9)). */
  n: number
  key: string
  name: string
  rarity: Rarity
  price: number
  baseProductionPerHour: number
  baseUpgradeCost: number
  maxLevel: number
  /** Путь к картинке в public/assets/chickens. */
  asset: string
  /** Оттенок заглушки (градусы hue-rotate), пока у курицы нет своей картинки. */
  tint: number
}

/** Курица, которой владеет игрок. */
export interface OwnedChicken {
  id: string
  key: string
  level: number
  acquiredAt: number
}

/** Балансы игрока. Числа пока number — на бэкенде будут BIGINT/строки. */
export interface Balance {
  coins: number
  eggs: number
  energy: number
  energyMax: number
  storageCapacity: number
}

export interface PlayerProfile {
  id: string
  name: string
  farmName: string
  level: number
  xp: number
}

export interface RewardState {
  /** Какой день серии заберётся следующим (0..6). */
  streakDay: number
  lastClaimAt: number | null
}

/** Полное состояние сохранения (mock-бэкенд хранит его целиком). */
export interface GameState {
  profile: PlayerProfile
  balance: Balance
  chickens: OwnedChicken[]
  displayedChickenId: string | null
  /** Уровень прокачки максимума энергии (0 = 300). */
  energyLevel: number
  /** Уровень прокачки склада (0 = 1 000 яиц). */
  storageLevel: number
  /** Уже активированные бонус-коды. */
  redeemedCodes: string[]
  lastProductionAt: number
  energyUpdatedAt: number
  reward: RewardState
  version: number
}

export interface LeaderboardEntry {
  rank: number
  name: string
  farmName?: string | null
  level?: number
  /** Сколько монет вложено в куриц (= XP). */
  farmValue: number
  isMe?: boolean
}

export interface Friend {
  id: string
  name: string
  level?: number
  active: boolean
}
