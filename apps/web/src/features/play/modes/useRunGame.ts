import { computed, onUnmounted, ref } from 'vue'
import { api, ApiError } from '@/services/api'
import type { ChickenFlightHistoryEntry, ChickenFlightStatus } from '@/services/apiTypes'
import { CHICKEN_FLIGHT, flightMultiplierAt, flightReward, flightZone } from '@/economy/chickenFlight'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { playMusic, playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { t } from '@/i18n'

export type FlightState = 'IDLE' | 'STARTING' | 'FLYING' | 'COLLECTING' | 'COLLECTED' | 'CRASHED'

export function useRunGame() {
  const game = useGameStore()
  const ui = useUiStore()
  const state = ref<FlightState>('IDLE')
  const amount = ref(100)
  const targetMultiplier = ref(2)
  const sessionId = ref<string | null>(null)
  const startedAt = ref(0)
  const now = ref(Date.now())
  const settledMultiplier = ref(0)
  const settledReward = ref(0)
  const settledAmount = ref(0)
  const history = ref<ChickenFlightHistoryEntry[]>([])
  const stats = ref({ flights: 0, bestMultiplier: 0, largestReward: 0, totalCollected: 0 })
  const milestone = ref('')
  const error = ref('')

  let raf = 0
  let pollTimer = 0
  let lastMilestone = 0

  const balance = computed(() => game.balance?.eggs ?? 0)
  const currentMultiplier = computed(() => (
    state.value === 'FLYING' || state.value === 'COLLECTING'
      ? flightMultiplierAt(now.value - startedAt.value)
      : settledMultiplier.value || 1
  ))
  const currentReward = computed(() => flightReward(amount.value, currentMultiplier.value))
  const zone = computed(() => flightZone(currentMultiplier.value))
  const canLaunch = computed(() => (
    state.value === 'IDLE' &&
    amount.value >= CHICKEN_FLIGHT.minAmount &&
    amount.value <= CHICKEN_FLIGHT.maxAmount &&
    amount.value <= balance.value &&
    targetMultiplier.value >= 1.01 &&
    targetMultiplier.value <= CHICKEN_FLIGHT.maxMultiplier
  ))

  function clampAmount(v: number) {
    const max = Math.min(CHICKEN_FLIGHT.maxAmount, Math.max(CHICKEN_FLIGHT.minAmount, balance.value))
    amount.value = Math.max(CHICKEN_FLIGHT.minAmount, Math.min(max, Math.floor(v)))
  }

  function setAmount(v: number) {
    clampAmount(v)
    playSound('click', 0.4)
  }

  function setCustomAmount(v: string | number) {
    const n = Math.floor(Number(v))
    if (!Number.isFinite(n)) return
    clampAmount(n)
  }

  function setTargetMultiplier(v: string | number) {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)
    if (!Number.isFinite(n)) return
    targetMultiplier.value = Math.max(1.01, Math.min(CHICKEN_FLIGHT.maxMultiplier, Math.floor(n * 100) / 100))
  }

  function step(delta: number) {
    clampAmount(amount.value + delta)
    playSound('click', 0.35)
  }

  function tick() {
    now.value = Date.now()
    const m = currentMultiplier.value
    const hit = [...CHICKEN_FLIGHT.milestones].reverse().find((x) => m >= x.at)
    if (hit && hit.at > lastMilestone) {
      lastMilestone = hit.at
      milestone.value = hit.label
      playSound(hit.at >= 10 ? 'lvlup' : 'chickenRun', 0.45)
      haptics.medium()
      window.setTimeout(() => {
        if (milestone.value === hit.label) milestone.value = ''
      }, 1100)
    }
    if (m >= targetMultiplier.value && state.value === 'FLYING') void collect()
    raf = requestAnimationFrame(tick)
  }

  function startLoop() {
    cancelAnimationFrame(raf)
    now.value = Date.now()
    raf = requestAnimationFrame(tick)
  }

  function stopLoop() {
    cancelAnimationFrame(raf)
  }

  function stopPolling() {
    window.clearInterval(pollTimer)
  }

  function applyCrashedFromHistory(id: string | null) {
    const entry = history.value.find((x) => x.id === id && x.status === 'CRASHED')
    if (!entry) return false
    stopLoop()
    stopPolling()
    settledMultiplier.value = entry.multiplier
    settledReward.value = 0
    settledAmount.value = entry.amount
    sessionId.value = null
    state.value = 'CRASHED'
    ui.playing = false
    playMusic('farm')
    playSound('error', 0.8)
    haptics.error()
    return true
  }

  function startPolling() {
    stopPolling()
    pollTimer = window.setInterval(async () => {
      if (state.value !== 'FLYING' || !sessionId.value) return
      try {
        const id = sessionId.value
        const res = await api.chickenFlightActive()
        game.applyState(res.state)
        history.value = res.history
        stats.value = res.stats
        if (!res.session) applyCrashedFromHistory(id)
      } catch {
        /* A temporary network miss should not end the run. */
      }
    }, 900)
  }

  async function loadActive() {
    try {
      const res = await api.chickenFlightActive()
      game.applyState(res.state)
      history.value = res.history
      stats.value = res.stats
      if (res.session) {
        sessionId.value = res.session.sessionId
        startedAt.value = res.session.startedAt
        amount.value = res.session.amount
        state.value = 'FLYING'
        ui.playing = true
        playMusic('play')
        startLoop()
        startPolling()
      }
    } catch {
      /* Active session is optional. */
    }
  }

  async function launch() {
    if (!canLaunch.value || state.value !== 'IDLE') return
    state.value = 'STARTING'
    error.value = ''
    try {
      const res = await api.chickenFlightStart(amount.value)
      game.applyState(res.state)
      sessionId.value = res.sessionId
      startedAt.value = res.startedAt
      settledMultiplier.value = 0
      settledReward.value = 0
      settledAmount.value = res.amount
      lastMilestone = 0
      milestone.value = 'FLY!'
      state.value = 'FLYING'
      ui.playing = true
      playMusic('play')
      playSound('chickenRun', 0.65)
      haptics.light()
      startLoop()
      startPolling()
      window.setTimeout(() => {
        if (milestone.value === 'FLY!') milestone.value = ''
      }, 900)
    } catch (e) {
      state.value = 'IDLE'
      playSound('error', 0.7)
      haptics.error()
      error.value = t(`errors.${e instanceof ApiError ? e.code : 'UNKNOWN'}`)
      ui.toast(error.value, 'error')
    }
  }

  async function collect() {
    if (state.value !== 'FLYING' || !sessionId.value) return
    state.value = 'COLLECTING'
    stopLoop()
    try {
      const res = await api.chickenFlightCollect(sessionId.value)
      stopPolling()
      game.applyState(res.state)
      history.value = res.history
      settledMultiplier.value = res.multiplier
      settledReward.value = res.reward
      settledAmount.value = res.amount
      state.value = res.success ? 'COLLECTED' : 'CRASHED'
      sessionId.value = null
      ui.playing = false
      playMusic('farm')
      playSound(res.success ? 'collect' : 'error', 0.8)
      haptics[res.success ? 'success' : 'error']()
    } catch (e) {
      state.value = 'FLYING'
      startLoop()
      startPolling()
      playSound('error', 0.7)
      haptics.error()
      error.value = t(`errors.${e instanceof ApiError ? e.code : 'UNKNOWN'}`)
      ui.toast(error.value, 'error')
    }
  }

  function playAgain() {
    stopLoop()
    stopPolling()
    sessionId.value = null
    settledMultiplier.value = 0
    settledReward.value = 0
    settledAmount.value = 0
    milestone.value = ''
    error.value = ''
    state.value = 'IDLE'
    ui.playing = false
    playMusic('farm')
    clampAmount(amount.value)
  }

  function stop() {
    stopLoop()
    stopPolling()
    if (state.value !== 'FLYING' && state.value !== 'COLLECTING') ui.playing = false
  }

  onUnmounted(stop)

  return {
    CONFIG: CHICKEN_FLIGHT,
    state,
    amount,
    targetMultiplier,
    balance,
    currentMultiplier,
    currentReward,
    settledMultiplier,
    settledReward,
    settledAmount,
    history,
    stats,
    milestone,
    zone,
    canLaunch,
    loadActive,
    setAmount,
    setCustomAmount,
    setTargetMultiplier,
    step,
    launch,
    collect,
    playAgain,
  }
}
