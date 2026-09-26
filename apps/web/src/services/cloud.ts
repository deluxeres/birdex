// Связь с сервером (Cloudflare Worker, apps/api).
// Работает только внутри Telegram: запросы подписаны initData, сервер проверяет подпись.
// В обычном браузере cloud выключен — игра сохраняется локально, рейтинг/друзья пустые.

import { getInitData } from './telegram'
import { ApiError } from './apiTypes'
import type { ChickenFlightActiveResult, ChickenFlightCollectResult, ChickenFlightStartResult, DoubleBet, DoubleHistoryEntry, DoubleSpinResult } from './apiTypes'
import type { GameState, LeaderboardEntry, Friend, RatingKind } from '@/types/game'

const SAVE_DEBOUNCE_MS = 1500

export function cloudEnabled(): boolean {
  return getInitData().length > 0
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `tma ${getInitData()}`, 'content-type': 'application/json' },
  })
  if (!res.ok) {
    // Сервер отвечает {error: 'КОД'} — отдаём код дальше, чтобы показать понятную ошибку.
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? 'UNKNOWN')
  }
  return (await res.json()) as T
}

export interface LoginResult {
  user: { id: string; name: string }
  state: GameState | null
}

export function cloudLogin(): Promise<LoginResult> {
  return api<LoginResult>('/api/auth', { method: 'POST', body: '{}' })
}

// ── Сохранение: копим изменения и отправляем раз в 1.5 сек ──
let pending: GameState | null = null
let timer: number | undefined

function send(state: GameState, keepalive = false): void {
  fetch('/api/state', {
    method: 'PUT',
    keepalive,
    headers: { authorization: `tma ${getInitData()}`, 'content-type': 'application/json' },
    body: JSON.stringify(state),
  }).catch(() => {
    /* нет сети — следующее сохранение повторит */
  })
}

export function cloudSave(state: GameState): void {
  if (!cloudEnabled()) return
  pending = state
  window.clearTimeout(timer)
  timer = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
}

export function flushSave(): void {
  window.clearTimeout(timer)
  if (pending) send(pending, true)
  pending = null
}

// Свернул Telegram / закрыл игру — сразу отправляем, что накопилось.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave()
  })
}

export async function cloudLeaderboard(
  kind: RatingKind,
): Promise<{ top: LeaderboardEntry[]; me: { rank: number; value: number } | null }> {
  return api(`/api/leaderboard?by=${kind}`)
}

export async function cloudFriends(): Promise<{ friends: Friend[]; pending: number; total: number }> {
  return api('/api/friends')
}

/** Забрать 12% с продаж друзей. Перед этим отправляем свежее сохранение. */
export async function cloudClaimReferral(): Promise<number> {
  flushSave()
  return (await api<{ coins: number }>('/api/ref/claim', { method: 'POST', body: '{}' })).coins
}

export async function cloudClaimInviteTask(target: 5 | 10 | 25 | 100): Promise<{ coins: number; birdPoints?: number; state: GameState }> {
  flushSave()
  return api('/api/ref/task-claim', { method: 'POST', body: JSON.stringify({ target }) })
}

// ── Бонус за подписку на канал: проверяет сервер через Telegram ──
export function cloudChannelCheck(): Promise<{ subscribed: boolean; claimed: boolean }> {
  return api('/api/channel/check', { method: 'POST', body: '{}' })
}

export function cloudChannelClaim(): Promise<{ coins: number }> {
  return api('/api/channel/claim', { method: 'POST', body: '{}' })
}

export function cloudChickenFlightActive(): Promise<ChickenFlightActiveResult> {
  return api('/api/games/chicken-flight/active')
}

export function cloudChickenFlightStart(amount: number): Promise<ChickenFlightStartResult> {
  flushSave()
  return api('/api/games/chicken-flight/start', { method: 'POST', body: JSON.stringify({ amount }) })
}

export function cloudChickenFlightCollect(sessionId: string): Promise<ChickenFlightCollectResult> {
  flushSave()
  return api('/api/games/chicken-flight/collect', { method: 'POST', body: JSON.stringify({ sessionId }) })
}

// ── Дабл: результат спина решает сервер ──
export function cloudDoubleHistory(): Promise<{ history: DoubleHistoryEntry[] }> {
  return api('/api/games/double/history')
}

export function cloudDoubleSpin(amount: number, bet: DoubleBet): Promise<DoubleSpinResult> {
  flushSave()
  return api('/api/games/double/spin', { method: 'POST', body: JSON.stringify({ amount, bet }) })
}
