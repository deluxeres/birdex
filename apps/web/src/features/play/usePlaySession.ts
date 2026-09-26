// Логика Play: попытка на 30 секунд с 3 жизнями, сложность растёт с каждым яйцом.
// Ледяное яйцо замедляет всё в 3 раза на 10 сек.
// Энергия списывается сервером на старте. В конце сервер проверяет итог.

import { ref, computed, onUnmounted, watch } from 'vue'
import { ECONOMY } from '@/config/economy'
import { comboMultiplier } from '@/economy/combo'
import { spawnIntervalMs, fallDurationMs } from '@/economy/playDifficulty'
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
  trashIcon?: string
  caught: boolean
}

export type EggKind = 'normal' | 'golden' | 'ice' | 'trash'

export type Phase = 'idle' | 'starting' | 'running' | 'finishing' | 'result'

const P = ECONOMY.play
const MAX_EGGS_ON_SCREEN = 34
const TRASH_ICONS = ['rotten_egg', '🥫', '🪵', '🧱', '🪨', '🍂'] as const

export function usePlaySession() {
  const game = useGameStore()
  const ui = useUiStore()
  preloadSounds(['eggCatch', 'eggGolden', 'miss', 'ice'])

  const phase = ref<Phase>('idle')
  const eggs = ref<FallingEgg[]>([])
  const lives = ref(P.lives)
  const normalCaught = ref(0)
  const goldenCaught = ref(0)
  const score = ref(0)
  const remainingSeconds = ref(P.durationSeconds)
  const streak = ref(0)
  const maxCombo = ref(1)
  const lastResult = ref(0)
  /** Мигание сердечек и тряска экрана при потере жизни. */
  const hurt = ref(false)
  /** Скорость времени: 1 — обычно, 1/3 — заморозка. */
  const timeScale = ref(1)
  /** Сколько секунд заморозки осталось (для таймера на экране). */
  const frozenLeft = ref(0)
  // Пока идёт попытка — нижнее меню спрятано.
  watch(phase, (p) => (ui.playing = p === 'running'))

  let ticket: Omit<PlaySessionTicket, 'state'> | null = null
  let spawnTimer: number | undefined
  let iceTimer: number | undefined
  let freezeTimer: number | undefined
  let playTimer: number | undefined
  let lastCatchAt = 0
  let nextId = 1

  const caught = computed(() => normalCaught.value + goldenCaught.value)
  const combo = computed(() => comboMultiplier(streak.value))
  const eggValue = computed(() => P.normalReward)

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
    const nextKind = kind ?? randomKind()
    eggs.value.push({
      id: nextId++,
      x: 8 + Math.random() * 84,
      drift: (Math.random() - 0.5) * 80,
      spin: (Math.random() - 0.5) * 360,
      duration: fallDurationMs(caught.value),
      kind: nextKind,
      trashIcon: nextKind === 'trash' ? TRASH_ICONS[Math.floor(Math.random() * TRASH_ICONS.length)] : undefined,
      caught: false,
    })
  }

  function randomKind(): EggKind {
    const roll = Math.random()
    if (roll < P.goldenChance) return 'golden'
    if (roll < P.goldenChance + P.trashChance) return 'trash'
    return 'normal'
  }

  /** Объект долетел до низа. Пропуск не штрафуется: опасен именно клик по мусору. */
  function eggLanded(id: number) {
    const egg = eggs.value.find((e) => e.id === id)
    eggs.value = eggs.value.filter((e) => e.id !== id)
    if (!egg || egg.caught || phase.value !== 'running') return
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
    if (egg.kind === 'trash') {
      streak.value = 0
      lives.value--
      playSound('miss', 0.8)
      haptics.error()
      hurt.value = false
      requestAnimationFrame(() => (hurt.value = true))
      if (lives.value <= 0) finish()
      return -2
    }
    if (egg.kind === 'ice') {
      freeze()
      return -1 // особый код: показать ❄ вместо +N
    }
    if (egg.kind === 'golden') {
      goldenCaught.value++
      score.value += P.goldenReward
      playSound('eggGolden', 0.8)
      haptics.medium()
      return P.goldenReward
    } else {
      const reward = Math.random() < 0.5 ? 1 : 2
      normalCaught.value++
      score.value += reward
      playSound('eggCatch', 0.6, 0.08)
      return reward
    }
  }

  /** Заморозка: всё на 10% медленнее (iceSlowFactor) на 10 сек, повторная — продлевает. */
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

  function startPlayTimer() {
    window.clearInterval(playTimer)
    remainingSeconds.value = P.durationSeconds
    playTimer = window.setInterval(() => {
      if (phase.value !== 'running') return
      // Во время заморозки (ледяное яйцо) время попытки стоит, потом идёт дальше с того же места.
      if (frozenLeft.value > 0) return
      remainingSeconds.value--
      if (remainingSeconds.value <= 0) finish()
    }, 1000)
  }

  function stopTimers() {
    window.clearTimeout(spawnTimer)
    window.clearTimeout(iceTimer)
    window.clearInterval(playTimer)
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
    score.value = 0
    remainingSeconds.value = P.durationSeconds
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
    startPlayTimer()
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
        eggsEarned: score.value,
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
    ui.playing = false
  })

  return {
    phase, eggs, lives, hurt, timeScale, frozenLeft, remainingSeconds, caught, normalCaught, goldenCaught, combo, score, eggValue, lastResult,
    start, finish, catchEgg, eggLanded,
  }
}
