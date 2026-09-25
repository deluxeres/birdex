// Главный стор: авторитетное состояние с "сервера" + действия-намерения.
// Балансы обновляются ТОЛЬКО из ответа API (без оптимистичных правок).

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ApiError } from '@/services/api'
import { getChickenDef } from '@/config/chickens'
import { accumulatedEggs, farmProductionPerHour } from '@/economy/production'
import { currentEnergy } from '@/economy/energy'
import type { GameState } from '@/types/game'
import { useUiStore } from './ui'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { t } from '@/i18n'

export const useGameStore = defineStore('game', () => {
  const state = ref<GameState | null>(null)
  const loading = ref(true)
  const pending = ref<string | null>(null)
  const now = ref(Date.now())

  let timer: number | undefined
  function startClock() {
    stopClock()
    timer = window.setInterval(() => (now.value = Date.now()), 1000)
  }
  function stopClock() {
    if (timer) window.clearInterval(timer)
  }

  const profile = computed(() => state.value?.profile)
  const balance = computed(() => state.value?.balance)
  const chickens = computed(() => state.value?.chickens ?? [])
  const perHour = computed(() => farmProductionPerHour(chickens.value))

  const displayedChicken = computed(() => {
    const s = state.value
    if (!s) return null
    return s.chickens.find((c) => c.id === s.displayedChickenId) ?? s.chickens[0] ?? null
  })

  /** Сколько яиц уже можно собрать (превью, реальное число даст сервер). */
  const readyToCollect = computed(() => {
    const s = state.value
    if (!s) return 0
    return accumulatedEggs({
      perHour: perHour.value,
      lastProductionAt: s.lastProductionAt,
      now: now.value,
      eggsInStorage: s.balance.eggs,
      storageCapacity: s.balance.storageCapacity,
    })
  })

  const energy = computed(() => {
    const s = state.value
    if (!s) return 0
    return currentEnergy({
      energy: s.balance.energy,
      energyMax: s.balance.energyMax,
      energyUpdatedAt: s.energyUpdatedAt,
      now: now.value,
    })
  })

  const ownsChicken = (key: string) => chickens.value.some((c) => c.key === key)

  /** Обёртка для любой мутации: блокирует повторный клик, ловит ошибки. */
  async function run<T>(id: string, fn: () => Promise<T>): Promise<T | null> {
    if (pending.value) return null
    pending.value = id
    try {
      return await fn()
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'UNKNOWN'
      useUiStore().toast(t(`errors.${code}`), 'error')
      playSound('error', 0.7)
      haptics.error()
      await refresh() // после ошибки — всегда берём правду с сервера
      return null
    } finally {
      pending.value = null
    }
  }

  async function load() {
    loading.value = true
    state.value = await api.me()
    loading.value = false
    startClock()
  }

  async function refresh() {
    try {
      state.value = await api.me()
    } catch {
      /* сеть упала — оставляем как есть */
    }
  }

  async function collect() {
    const res = await run('collect', () => api.collect())
    if (!res) return 0
    state.value = res.state
    if (res.collected > 0) {
      playSound('collect')
      haptics.success()
    }
    return res.collected
  }

  async function sellEggs(amount: number) {
    const res = await run('sell', () => api.sellEggs(amount))
    if (!res) return null
    state.value = res.state
    playSound('sell')
    haptics.success()
    return res
  }

  async function buyChicken(key: string) {
    const res = await run(`buy:${key}`, () => api.buyChicken(key))
    if (!res) return false
    state.value = res
    playSound('buy')
    haptics.success()
    useUiStore().toast(t('shop.bought', { name: getChickenDef(key).name }), 'success')
    return true
  }

  async function upgradeChicken(id: string) {
    const res = await run(`upgrade:${id}`, () => api.upgradeChicken(id))
    if (!res) return false
    state.value = res
    playSound('improve')
    haptics.success()
    return true
  }

  async function upgradeEnergy() {
    const res = await run('energy', () => api.upgradeEnergy())
    if (!res) return false
    state.value = res
    playSound('buyEnergy')
    haptics.success()
    return true
  }

  async function upgradeStorage() {
    const res = await run('storage', () => api.upgradeStorage())
    if (!res) return false
    state.value = res
    playSound('buyEnergy')
    haptics.success()
    return true
  }

  async function redeemCode(code: string) {
    const res = await run('promo', () => api.redeemCode(code))
    if (!res) return null
    state.value = res.state
    playSound('reward')
    haptics.success()
    return { coins: res.coins, energy: res.energy }
  }

  async function displayChicken(id: string) {
    const res = await run(`display:${id}`, () => api.displayChicken(id))
    if (res) state.value = res
  }

  async function claimReward() {
    const res = await run('reward', () => api.claimReward())
    if (!res) return null
    state.value = res.state
    playSound('reward')
    haptics.success()
    return res
  }

  async function renameFarm(name: string) {
    const res = await run('rename', () => api.renameFarm(name))
    if (res) state.value = res
  }

  function applyState(s: GameState) {
    state.value = s
  }

  return {
    state, loading, pending, now,
    profile, balance, chickens, perHour, displayedChicken, readyToCollect, energy,
    ownsChicken, load, refresh, collect, sellEggs, buyChicken, upgradeChicken, upgradeEnergy, upgradeStorage, redeemCode,
    displayChicken, claimReward, renameFarm, applyState, stopClock,
  }
})
