// Контракт API. Клиент шлёт НАМЕРЕНИЕ, сервер считает результат.
// Mock и реальный HTTP-клиент реализуют один и тот же интерфейс.

import type { GameState, LeaderboardEntry, Friend } from '@/types/game'

export interface CollectResult { collected: number; state: GameState }
export interface SellResult { eggsSold: number; coinsReceived: number; state: GameState }
export interface RewardResult { coins: number; day: number; state: GameState }
export interface LeaderboardResult {
  top: LeaderboardEntry[]
  me: { rank: number; farmValue: number } | null
  /** false — игра открыта не в Telegram, рейтинга нет. */
  online: boolean
}
export interface PromoResult { coins: number; energy: number; state: GameState }

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
  maxCombo: number
}

export interface PlayResult { eggsAwarded: number; state: GameState }

export interface GameApi {
  me(): Promise<GameState>
  collect(): Promise<CollectResult>
  sellEggs(amount: number): Promise<SellResult>
  buyChicken(key: string): Promise<GameState>
  upgradeChicken(chickenId: string): Promise<GameState>
  upgradeEnergy(): Promise<GameState>
  upgradeStorage(): Promise<GameState>
  redeemCode(code: string): Promise<PromoResult>
  displayChicken(chickenId: string): Promise<GameState>
  claimReward(): Promise<RewardResult>
  startPlay(): Promise<PlaySessionTicket>
  finishPlay(summary: PlaySessionSummary): Promise<PlayResult>
  leaderboard(): Promise<LeaderboardResult>
  friends(): Promise<{ friends: Friend[]; online: boolean }>
  renameFarm(name: string): Promise<GameState>
}

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code)
  }
}
