import type { ExtraMode, ModeEnergy } from '@/economy/modes'
// Общие типы игры. Позже переедут в packages/shared, когда появится бэкенд.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type TabId = 'farm' | 'play' | 'chickens' | 'market' | 'earn' | 'shop' | 'season'

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
  /** Сколько раз уже меняли название фермы (первая смена бесплатная). */
  renames?: number
  level: number
  xp: number
  /** Ключ курицы-аватарки (любая из 36). Нет — фермер. */
  avatar?: string
}

/** Статистика для рейтинга и рефералки. */
export interface PlayerStats {
  /** Всего монет получено с продажи яиц (с этого друг даёт 12% пригласившему). */
  soldCoins: number
  /** Всего продано яиц (за каждые 100 — 1 BIRD Point). */
  soldEggs?: number
  /** Рекорд яиц за одну игру в Play. */
  bestPlay: number
}

export interface RewardState {
  /** Какой день серии заберётся следующим (0..6). */
  streakDay: number
  lastClaimAt: number | null
}

export interface EventState {
  channelSubscribed: boolean
  channelBonusClaimed: boolean
  invite5Claimed?: boolean
  invite10Claimed?: boolean
  invite25Claimed?: boolean
  invite100Claimed?: boolean
}

export interface SeasonState {
  id: number
  points: number
  startedAt: number
  endsAt: number
  lastSnapshotAt: number | null
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
  events: EventState
  season: SeasonState
  stats: PlayerStats
  /** Отдельная энергия режимов Play (Лисы, Бомбы). */
  modeEnergy: Record<ExtraMode, ModeEnergy>
  version: number
}

export type RatingKind = 'coins' | 'play'

export interface LeaderboardEntry {
  rank: number
  name: string
  farmName?: string | null
  level?: number
  avatar?: string | null
  /** Монеты (вкладка "Монеты") или рекорд яиц за игру (вкладка "Play"). */
  value: number
  isMe?: boolean
}

export interface Friend {
  id: string
  name: string
  farmName?: string | null
  level?: number
  coins?: number
  avatar?: string | null
  /** Сколько монет (12%) этот друг уже принёс мне. */
  earned?: number
  active: boolean
}
