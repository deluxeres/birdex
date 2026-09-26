// Контракт API. Клиент шлёт НАМЕРЕНИЕ, сервер считает результат.
// Mock и реальный HTTP-клиент реализуют один и тот же интерфейс.

import type { ExtraMode } from '@/economy/modes'
import type { GameState, LeaderboardEntry, Friend, RatingKind } from '@/types/game'

export interface CollectResult { collected: number; state: GameState }
export interface SellResult { eggsSold: number; coinsReceived: number; birdPointsAwarded: number; state: GameState }
export interface RewardResult { coins: number; day: number; state: GameState }
export interface LeaderboardResult {
  top: LeaderboardEntry[]
  me: { rank: number; value: number } | null
  /** false — игра открыта не в Telegram, рейтинга нет. */
  online: boolean
}
export interface FriendsResult {
  friends: Friend[]
  /** 12% с продаж друзей, которые можно забрать. */
  pending: number
  /** Всего получено с друзей. */
  total: number
  online: boolean
}
export interface PromoResult { coins: number; energy: number; energyMode?: 'catch' | 'fox' | 'run' | 'double'; state: GameState }

export interface PlaySessionTicket {
  sessionId: string
  startedAt: number
  expiresAt: number
  /** Состояние после списания энергии за попытку. */
  state: GameState
}

export interface PlaySessionSummary {
  sessionId: string
  normalCaught: number
  goldenCaught: number
  eggsEarned: number
  maxCombo: number
}

/** Итог попытки в режимах Лисы / Бомбы. Сервер сам проверяет правдоподобность. */
export interface ModeSummary {
  sessionId: string
  mode: ExtraMode
  /** Лисы: сколько убито обычных и плотных. */
  kills?: number
  tanks?: number
  /** Бомбы: сколько секунд продержался. */
  seconds?: number
}

export interface PlayResult { eggsAwarded: number; state: GameState }

export type ChickenFlightStatus = 'FLYING' | 'COLLECTED' | 'CRASHED'

export interface ChickenFlightHistoryEntry {
  id: string
  status: ChickenFlightStatus
  amount: number
  multiplier: number
  reward: number
  createdAt: number
}

export interface ChickenFlightStartResult {
  sessionId: string
  amount: number
  startedAt: number
  status: 'FLYING'
  state: GameState
}

export interface ChickenFlightActiveResult {
  session: ChickenFlightStartResult | null
  history: ChickenFlightHistoryEntry[]
  stats: {
    flights: number
    bestMultiplier: number
    largestReward: number
    totalCollected: number
  }
  state: GameState
}

export interface ChickenFlightCollectResult {
  success: boolean
  status: ChickenFlightStatus
  multiplier: number
  reward: number
  amount: number
  state: GameState
  history: ChickenFlightHistoryEntry[]
}

export type DoubleBet = 'red' | 'black' | 'green'

export interface DoubleHistoryEntry {
  id: string
  bet: DoubleBet
  slot: number
  color: DoubleBet
  amount: number
  reward: number
  createdAt: number
}

export interface DoubleSpinResult {
  id: string
  slot: number
  color: DoubleBet
  win: boolean
  amount: number
  bet: DoubleBet
  reward: number
  state: GameState
  history: DoubleHistoryEntry[]
}

export interface GameApi {
  me(): Promise<GameState>
  collect(): Promise<CollectResult>
  sellEggs(amount: number): Promise<SellResult>
  buyChicken(key: string): Promise<GameState>
  upgradeChicken(chickenId: string): Promise<GameState>
  upgradeEnergy(): Promise<GameState>
  upgradeModeEnergy(mode: ExtraMode): Promise<GameState>
  upgradeStorage(): Promise<GameState>
  redeemCode(code: string): Promise<PromoResult>
  displayChicken(chickenId: string): Promise<GameState>
  claimReward(): Promise<RewardResult>
  startPlay(): Promise<PlaySessionTicket>
  finishPlay(summary: PlaySessionSummary): Promise<PlayResult>
  startMode(mode: ExtraMode): Promise<PlaySessionTicket>
  finishMode(summary: ModeSummary): Promise<PlayResult>
  chickenFlightActive(): Promise<ChickenFlightActiveResult>
  chickenFlightStart(amount: number): Promise<ChickenFlightStartResult>
  chickenFlightCollect(sessionId: string): Promise<ChickenFlightCollectResult>
  doubleHistory(): Promise<{ history: DoubleHistoryEntry[] }>
  doubleSpin(amount: number, bet: DoubleBet): Promise<DoubleSpinResult>
  leaderboard(kind: RatingKind): Promise<LeaderboardResult>
  friends(): Promise<FriendsResult>
  claimReferral(): Promise<{ coins: number; state: GameState }>
  claimInviteTask(target: 5 | 10 | 25 | 100): Promise<{ coins: number; birdPoints?: number; state: GameState }>
  verifyChannelSubscription(): Promise<{ subscribed: boolean; state: GameState }>
  claimChannelBonus(): Promise<{ coins: number; state: GameState }>
  renameFarm(name: string): Promise<GameState>
}

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code)
  }
}
