// Логика Play: бесконечная попытка с 3 жизнями, сложность растёт с каждым яйцом.
// Ледяное яйцо замедляет всё в 3 раза на 10 сек.
// Энергия списывается сервером на старте. В конце сервер проверяет итог.

import { ref, computed, onUnmounted } from 'vue'
import { ECONOMY } from '@/config/economy'
import { comboMultiplier } from '@/economy/combo'
import { spawnIntervalMs, fallDurationMs } from '@/economy/playDifficulty'
import { playEggValue } from '@/economy/progression'
import { api, ApiError } from '@/services/api'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { playSound, playMusic, preloadSounds } from '@/services/audio'
import { haptics } from '@/services/haptics'
import type { PlaySessionTicket } from '@/services/apiTypes'
import { t } from '@/i18n'

export interface FallingEgg {
  id: number
  x: number // 0..100 % ширины
  drift: number // горизонтальный снос, px
  spin: number // градусы
  duration: number // мс падения (зависит от сложности на момент появления)
  kind: EggKind
  caught: boolean
}

export type EggKind = 'normal' | 'golden' | 'ice'

export type Phase = 'idle' | 'starting' | 'running' | 'finishing' | 'result'

const P = ECONOMY.play
const MAX_EGGS_ON_SCREEN = 18

export function usePlaySession() {
  const game = useGameStore()
  const ui = useUiStore()
  preloadSounds(['eggCatch', 'eggGolden', 'miss', 'ice'])

  const phase = ref<Phase>('idle')
  const eggs = ref<FallingEgg[]>([])
  const lives = ref(P.lives)
  const normalCaught = ref(0)
  const goldenCaught = ref(0)
  const streak = ref(0)
  const maxCombo = ref(1)
  const lastResult = ref(0)
  /** Мигание сердечек и тряска экрана при потере жизни. */
  const hurt = ref(false)
  /** Скорость времени: 1 — обычно, 1/3 — заморозка. */
  const timeScale = ref(1)
  /** Сколько секунд заморозки осталось (для таймера на экране). */
  const frozenLeft = ref(0)

  let ticket: Omit<PlaySessionTicket, 'state'> | null = null
  let spawnTimer: number | undefined
  let iceTimer: number | undefined
  let freezeTimer: number | undefined
  let lastCatchAt = 0
  let nextId = 1

  const caught = computed(() => normalCaught.value + goldenCaught.value)
  const combo = computed(() => comboMultiplier(streak.value))
  /** Сколько яиц даёт одно пойманное яйцо (растёт с уровнем игрока). */
  const eggValue = computed(() => playEggValue(game.profile?.level ?? 1))
  const score = computed(
    () => (normalCaught.value * P.normalReward + goldenCaught.value * P.goldenReward) * eggValue.value,
  )

  // Следующее яйцо планируется по текущей сложности — чем больше поймал, тем чаще.
  function scheduleSpawn() {
    spawnTimer = window.setTimeout(() => {
      if (phase.value !== 'running') return
      spawn()
      scheduleSpawn()
    }, spawnIntervalMs(caught.value) / timeScale.value)
  }

  function spawn(kind?: EggKind) {
    if (eggs.value.filter((e) => !e.caught).length >= MAX_EGGS_ON_SCREEN) return
    eggs.value.push({
      id: nextId++,
      x: 8 + Math.random() * 84,
      drift: (Math.random() - 0.5) * 60,
      spin: (Math.random() - 0.5) * 240,
      duration: fallDurationMs(caught.value),
      kind: kind ?? (Math.random() < P.goldenChance ? 'golden' : 'normal'),
      caught: false,
    })
  }

  /** Яйцо долетело до низа. Не поймано — минус жизнь. */
  function eggLanded(id: number) {
    const egg = eggs.value.find((e) => e.id === id)
    eggs.value = eggs.value.filter((e) => e.id !== id)
    if (!egg || egg.caught || phase.value !== 'running') return
    if (egg.kind === 'ice') return // бонус: пропуск не наказывается
    streak.value = 0
    lives.value--
    playSound('miss', 0.8)
    haptics.error()
    hurt.value = false
    requestAnimationFrame(() => (hurt.value = true))
    if (lives.value <= 0) finish()
  }

  /** Возвращает награду за яйцо (для +N), или 0 если не засчитано. */
  function catchEgg(id: number): number {
    if (phase.value !== 'running') return 0
    const egg = eggs.value.find((e) => e.id === id)
    if (!egg || egg.caught) return 0
    const now = performance.now()
    streak.value = now - lastCatchAt <= P.comboWindowMs ? streak.value + 1 : 1
    lastCatchAt = now
    maxCombo.value = Math.max(maxCombo.value, combo.value)
    egg.caught = true
    setTimeout(() => (eggs.value = eggs.value.filter((e) => e.id !== id)), 250)
    if (egg.kind === 'ice') {
      freeze()
      return -1 // особый код: показать ❄ вместо +N
    }
    if (egg.kind === 'golden') {
      goldenCaught.value++
      playSound('eggGolden', 0.8)
      haptics.medium()
    } else {
      normalCaught.value++
      playSound('eggCatch', 0.6, 0.08)
    }
    return (egg.kind === 'golden' ? P.goldenReward : P.normalReward) * eggValue.value
  }

  /** Заморозка: всё в 3 раза медленнее на 10 сек (повторная — продлевает). */
  function freeze() {
    playSound('ice', 0.8)
    haptics.medium()
    timeScale.value = 1 / P.iceSlowFactor
    frozenLeft.value = P.iceSlowSeconds
    window.clearInterval(freezeTimer)
    freezeTimer = window.setInterval(() => {
      frozenLeft.value--
      if (frozenLeft.value <= 0) unfreeze()
    }, 1000)
  }

  function unfreeze() {
    window.clearInterval(freezeTimer)
    timeScale.value = 1
    frozenLeft.value = 0
  }

  /** Раз в 5 сек (по игровому времени) — шанс 15% на ледяное яйцо. */
  function scheduleIce() {
    iceTimer = window.setTimeout(() => {
      if (phase.value !== 'running') return
      if (Math.random() < P.iceChance) spawn('ice')
      scheduleIce()
    }, P.iceEveryMs / timeScale.value)
  }

  function stopTimers() {
    window.clearTimeout(spawnTimer)
    window.clearTimeout(iceTimer)
    unfreeze()
  }

  async function start() {
    if (phase.value === 'running' || phase.value === 'starting') return
    phase.value = 'starting'
    try {
      const res = await api.startPlay()
      game.applyState(res.state)
      ticket = { sessionId: res.sessionId, startedAt: res.startedAt, expiresAt: res.expiresAt }
    } catch (e) {
      phase.value = 'idle'
      playSound('error', 0.7)
      ui.toast(t(`errors.${e instanceof ApiError ? e.code : 'UNKNOWN'}`), 'error')
      return
    }
    normalCaught.value = 0
    goldenCaught.value = 0
    streak.value = 0
    maxCombo.value = 1
    lives.value = P.lives
    eggs.value = []
    phase.value = 'running'
    playMusic('play')
    unfreeze()
    spawn()
    scheduleSpawn()
    scheduleIce()
  }

  async function finish() {
    if (phase.value !== 'running' || !ticket) return
    stopTimers()
    phase.value = 'finishing'
    eggs.value = []
    try {
      const res = await api.finishPlay({
        sessionId: ticket.sessionId,
        normalCaught: normalCaught.value,
        goldenCaught: goldenCaught.value,
        maxCombo: maxCombo.value,
      })
      game.applyState(res.state)
      lastResult.value = res.eggsAwarded
      if (res.eggsAwarded > 0) haptics.success()
    } catch {
      lastResult.value = 0
      await game.refresh()
    }
    ticket = null
    phase.value = 'result'
    playMusic('farm')
  }

  // Ушёл с вкладки посреди игры — честно завершаем попытку с тем, что поймал.
  onUnmounted(() => {
    if (phase.value === 'running') finish()
    stopTimers()
  })

  return {
    phase, eggs, lives, hurt, timeScale, frozenLeft, caught, normalCaught, goldenCaught, combo, score, eggValue, lastResult,
    start, finish, catchEgg, eggLanded,
  }
}
