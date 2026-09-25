// Связь с сервером (Cloudflare Worker, apps/api).
// Работает только внутри Telegram: запросы подписаны initData, сервер проверяет подпись.
// В обычном браузере cloud выключен — игра сохраняется локально, рейтинг/друзья пустые.

import { getInitData } from './telegram'
import type { GameState, LeaderboardEntry, Friend } from '@/types/game'

const SAVE_DEBOUNCE_MS = 1500

export function cloudEnabled(): boolean {
  return getInitData().length > 0
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `tma ${getInitData()}`, 'content-type': 'application/json' },
  })
  if (!res.ok) throw new Error(`API ${path} ${res.status}`)
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

export async function cloudLeaderboard(): Promise<{ top: LeaderboardEntry[]; me: { rank: number; farmValue: number } | null }> {
  return api('/api/leaderboard')
}

export async function cloudFriends(): Promise<Friend[]> {
  return (await api<{ friends: Friend[] }>('/api/friends')).friends
}
