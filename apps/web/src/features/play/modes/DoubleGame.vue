<script setup lang="ts">
// Дабл: барабан на 38 слотов (2 зелёных — сверху и снизу, остальные красный/чёрный через один).
// Игрок ставит яйца на цвет → сервер выбирает слот → яйцо крутится по барабану и падает в этот слот.
// Красное/чёрное — x2, зелёное — x14. Каждый спин тратит энергию режима.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api, ApiError } from '@/services/api'
import type { DoubleBet, DoubleHistoryEntry, DoubleSpinResult } from '@/services/apiTypes'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { ECONOMY } from '@/config/economy'
import { ASSETS } from '@/config/assets'
import { DOUBLE_SLOTS } from '@/economy/double'
import { formatNumber } from '@/economy/format'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import EggIcon from '@/components/EggIcon.vue'
import EnergyIcon from '@/components/EnergyIcon.vue'
import { t } from '@/i18n'

const emit = defineEmits<{ back: [] }>()
const game = useGameStore()
const ui = useUiStore()
const D = ECONOMY.modes.double
const MODE_COLOR = '#3ccf5a'

// ---------- Ставка ----------
const amount = ref(100)
const lastBet = ref<DoubleBet | null>(null)
const spinning = ref(false)
const result = ref<DoubleSpinResult | null>(null)
const history = ref<DoubleHistoryEntry[]>([])

const balance = computed(() => game.balance?.eggs ?? 0)
const energy = computed(() => game.modeEnergy('double'))
const energyMax = computed(() => {
  const e = game.state?.modeEnergy?.double
  return e ? Math.min(ECONOMY.energy.max, ECONOMY.energy.start + (e.level ?? 0) * ECONOMY.energy.upgradeStep) : ECONOMY.energy.start
})
/** Пока крутится — показываем баланс и энергию уже за вычетом ставки (сервер уже списал). */
const shownBalance = computed(() => (spinning.value && result.value ? balance.value - result.value.amount : balance.value))
const shownEnergy = computed(() => (spinning.value ? Math.max(0, energy.value - D.playCost) : energy.value))

function clampAmount(v: number) {
  const max = Math.min(D.maxAmount, Math.max(D.minAmount, balance.value))
  amount.value = Math.max(D.minAmount, Math.min(max, Math.floor(v)))
}
function setAmount(v: number) {
  if (spinning.value) return
  clampAmount(v)
  playSound('click', 0.4)
}
function step(d: number) {
  setAmount(amount.value + d)
}
function onInput(e: Event) {
  const n = Math.floor(Number((e.target as HTMLInputElement).value))
  if (Number.isFinite(n)) clampAmount(n)
}

// ---------- Барабан ----------
const THETA = 360 / DOUBLE_SLOTS
const C = 150 // центр (координаты 0..300 поверх картинки барабана)
// Барабан — картинка play/double: крутится double_rotor, рамка с указателем double_frame стоит.
// Радиусы в тех же единицах (картинка 300×300).
const R_TRACK = 124 // дорожка у обода, по которой бегает яйцо
const R_POCKET = 109 // яйцо в слоте
/** Центры слотов на картинке (градусы по часовой от верха) — нарисованы чуть неравномерно, замерено. */
const SLOT_ANGLES = [
  0, 10.25, 20.25, 30, 39.38, 48.75, 57.75, 67, 76.12, 85, 93.88, 102.88, 112, 121.12, 130.38, 139.88, 149.62, 159.62, 170.38,
  181.5, 192.5, 203, 212.75, 222, 231.12, 239.88, 248.88, 257.75, 266.5, 275.25, 284, 292.88, 302, 311.12, 320.75, 330.38, 339.88, 349.62,
]

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

const wheelDeg = ref(0)
const eggDeg = ref(0) // угол яйца в мире (0 — верх, по часовой)
/** Сначала яйцо лежит в центре барабана; при первом спине вылетает на дорожку. */
const eggR = ref(0)
const eggStyle = computed(() => {
  const [x, y] = polar(eggR.value, eggDeg.value)
  // В центре яйцо крупнее, на барабане — по размеру слота.
  const scale = 1 + Math.max(0, 1 - eggR.value / 60) * 1.18
  return {
    left: (x / 300) * 100 + '%',
    top: (y / 300) * 100 + '%',
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${eggR.value < 1 ? 0 : eggDeg.value * 2}deg)`,
  }
})

/** Скорость яйца (град/кадр) — для лёгкого "ветра" за ним. */
const eggSpeed = ref(0)
/** Струйки ветра позади яйца: чем быстрее летит, тем длиннее и ярче. */
const wind = computed(() => {
  const sp = Math.min(14, Math.abs(eggSpeed.value))
  if (sp < 0.4 || eggR.value < 20) return []
  return [1, 2, 3, 4, 5].map((k) => {
    const deg = eggDeg.value + sp * k * 0.38 + 2 // позади яйца (оно летит против часовой)
    const [x, y] = polar(eggR.value + (k % 2 ? 3 : -3), deg)
    return {
      k,
      style: {
        left: (x / 300) * 100 + '%',
        top: (y / 300) * 100 + '%',
        opacity: String(Math.min(0.9, sp / 5) * (1 - k / 6.5)),
        transform: `translate(-50%, -50%) rotate(${deg}deg) scaleX(${0.6 + sp / 8})`,
      },
    }
  })
})

let raf = 0
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3
const easeOutQuart = (x: number) => 1 - (1 - x) ** 4
function bounce(x: number) {
  // Падение в слот с парой отскоков.
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}
const mod = (a: number, n: number) => ((a % n) + n) % n

function animateTo(slot: number): Promise<void> {
  return new Promise((resolve) => {
    const dur = 5600
    const w0 = wheelDeg.value
    const w1 = w0 + 360 * 4 + mod(-SLOT_ANGLES[slot] - w0, 360)
    const e0 = eggDeg.value
    const r0 = eggR.value
    const e1 = e0 - (360 * 6 + mod(e0, 360)) // против часовой, заканчивает наверху (0°)
    const t0 = performance.now()
    let lastSlot = -1
    let lastTick = 0
    const frame = (now: number) => {
      const x = Math.min(1, (now - t0) / dur)
      wheelDeg.value = w0 + (w1 - w0) * easeOutCubic(x)
      const prevEgg = eggDeg.value
      eggDeg.value = e0 + (e1 - e0) * easeOutQuart(x)
      eggSpeed.value = eggDeg.value - prevEgg
      // Сначала яйцо бежит по внешней дорожке, к концу падает в слот и подпрыгивает.
      if (x < 0.12 && r0 < R_TRACK) eggR.value = r0 + (R_TRACK - r0) * easeOutCubic(x / 0.12)
      else if (x < 0.58) eggR.value = R_TRACK
      else eggR.value = R_TRACK - (R_TRACK - R_POCKET) * bounce(Math.min(1, (x - 0.58) / 0.3))
      // Щелчки, когда яйцо перескакивает через слоты (под конец, когда медленно).
      if (x > 0.5) {
        const rel = Math.round(mod(eggDeg.value - wheelDeg.value, 360) / THETA) % DOUBLE_SLOTS
        if (rel !== lastSlot && now - lastTick > 70) {
          if (lastSlot !== -1) playSound('click', 0.22)
          lastTick = now
        }
        lastSlot = rel
      }
      if (x < 1) raf = requestAnimationFrame(frame)
      else {
        eggSpeed.value = 0
        resolve()
      }
    }
    raf = requestAnimationFrame(frame)
  })
}

/** После спина яйцо через секунду возвращается в центр барабана. */
let returnTimer = 0
function returnToCenter() {
  const r0 = eggR.value
  const t0 = performance.now()
  const dur = 650
  const frame = (now: number) => {
    const x = Math.min(1, (now - t0) / dur)
    eggR.value = r0 * (1 - easeOutCubic(x))
    if (x < 1) raf = requestAnimationFrame(frame)
    else eggDeg.value = 0
  }
  raf = requestAnimationFrame(frame)
}

// ---------- Спин ----------
/** Кнопка ставки, которая трясётся при ошибке (нет энергии / яиц). */
const shakeBet = ref<DoubleBet | null>(null)

async function spin(bet: DoubleBet) {
  if (spinning.value) return
  lastBet.value = bet
  if (energy.value < D.playCost) return fail('NO_ENERGY', bet)
  if (balance.value < D.minAmount || amount.value > balance.value) return fail('NOT_ENOUGH_EGGS', bet)
  window.clearTimeout(returnTimer)
  cancelAnimationFrame(raf)
  spinning.value = true
  result.value = null
  playSound('click', 0.6)
  haptics.light()
  let res: DoubleSpinResult
  try {
    res = await api.doubleSpin(amount.value, bet)
  } catch (e) {
    spinning.value = false
    return fail(e instanceof ApiError ? e.code : 'UNKNOWN')
  }
  result.value = res
  playSound('chickenRun', 0.5)
  await animateTo(res.slot)
  returnTimer = window.setTimeout(returnToCenter, 1300)
  game.applyState(res.state)
  history.value = res.history
  spinning.value = false
  if (res.win) {
    playSound(res.color === 'green' ? 'lvlup' : 'collect', 0.85)
    haptics.success()
  } else {
    playSound('error', 0.6)
    haptics.error()
  }
  clampAmount(amount.value)
}

function fail(code: string, bet?: DoubleBet) {
  if (bet) {
    shakeBet.value = null
    requestAnimationFrame(() => (shakeBet.value = bet))
  }
  playSound('error', 0.7)
  haptics.error()
  ui.toast(t(`errors.${code}`), 'error')
}

function back() {
  if (spinning.value) return
  emit('back')
}

const shownResult = computed(() => (!spinning.value ? result.value : null))
const net = computed(() => (shownResult.value ? shownResult.value.reward - shownResult.value.amount : 0))

onMounted(async () => {
  clampAmount(amount.value)
  try {
    history.value = (await api.doubleHistory()).history
  } catch {
    /* история не обязательна */
  }
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.clearTimeout(returnTimer)
  // Ушёл посреди спина — результат уже посчитан сервером, просто применяем.
  if (spinning.value && result.value) game.applyState(result.value.state)
})
</script>

<template>
  <div class="screen dbl">
    <div class="topbar">
      <button class="back" :disabled="spinning" @click="back">‹</button>
      <div class="ttl">
        <h1>DOUBLE</h1>
        <p>Virtual Eggs only</p>
      </div>
      <span class="balance"><EggIcon :size="20" /> {{ formatNumber(shownBalance) }}</span>
    </div>

    <div class="strip">
      <span class="en"><EnergyIcon mode="double" :color="MODE_COLOR" :size="16" /> {{ formatNumber(shownEnergy) }}<small>/{{ formatNumber(energyMax) }}</small></span>
      <div class="hist">
        <i v-for="h in history" :key="h.id" :class="h.color" />
        <span v-if="!history.length" class="muted">—</span>
      </div>
    </div>

    <section class="wheel-box">
      <div class="wheel-wrap">
        <img class="wheel rotor" :src="ASSETS.double.rotor" alt="" draggable="false" :style="{ transform: `rotate(${wheelDeg}deg)` }" />
        <img class="wheel frame" :src="ASSETS.double.frame" alt="" draggable="false" />

        <i v-for="w in wind" :key="'w' + w.k" class="gust" :style="w.style" />
        <img class="egg" :class="{ mid: eggR < 1 }" :src="ASSETS.eggs.normal" alt="" draggable="false" :style="eggStyle" />

        <div class="center">
          <!-- Результат — под кольцом в центре (яйцо возвращается в центр). -->
          <div v-if="shownResult" class="below">
            <span class="res-chip" :class="shownResult.color">{{ shownResult.color === 'green' ? 'x14' : 'x2' }}</span>
            <b :class="shownResult.win ? 'won' : 'lost'">{{ net >= 0 ? '+' : '−' }}{{ formatNumber(Math.abs(net)) }}</b>
          </div>
          <template v-else-if="!spinning">
            <span class="idle-txt">{{ t('double.pick') }}</span>
          </template>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="label">{{ t('double.amount') }}</div>
      <div class="amount-box">
        <button class="sq" :disabled="spinning" @click="step(-25)">−</button>
        <label>
          <EggIcon :size="24" />
          <input :value="amount" inputmode="numeric" pattern="[0-9]*" :disabled="spinning" @input="onInput" />
        </label>
        <button class="sq" :disabled="spinning" @click="step(25)">+</button>
      </div>
      <div class="chips">
        <button v-for="p in D.presets" :key="p" :class="{ on: amount === p }" :disabled="spinning || p > balance" @click="setAmount(p)">{{ p }}</button>
      </div>

      <div class="bets">
        <button class="bet red" :class="{ on: lastBet === 'red', 'shake-x': shakeBet === 'red' }" :disabled="spinning" @click="spin('red')" @animationend="shakeBet = null">
          <span>{{ t('double.red') }}</span><b>x2</b>
        </button>
        <button class="bet green" :class="{ on: lastBet === 'green', 'shake-x': shakeBet === 'green' }" :disabled="spinning" @click="spin('green')" @animationend="shakeBet = null">
          <span>{{ t('double.green') }}</span><b>x14</b>
        </button>
        <button class="bet black" :class="{ on: lastBet === 'black', 'shake-x': shakeBet === 'black' }" :disabled="spinning" @click="spin('black')" @animationend="shakeBet = null">
          <span>{{ t('double.black') }}</span><b>x2</b>
        </button>
      </div>
      <p class="cost"><EnergyIcon mode="double" :color="MODE_COLOR" :size="14" /> {{ t('double.cost', { n: D.playCost }) }}</p>
    </section>
  </div>
</template>

<style scoped>
.dbl {
  position: relative; z-index: 1; flex: 1; min-height: 0; gap: 8px;
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 14px);
}
.topbar {
  display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(58, 36, 18, 0.92), rgba(34, 21, 11, 0.94));
  border: 2px solid rgba(160, 108, 52, 0.7); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
}
.back {
  width: 36px; height: 36px; border-radius: 10px; color: #3a2108; font-size: 26px; font-weight: 900; line-height: 1;
  background: linear-gradient(180deg, #ffe17a, var(--gold)); box-shadow: 0 3px 0 var(--gold-dark);
}
.back:disabled { opacity: 0.4; }
h1, p { margin: 0; }
.ttl h1 { font-size: 19px; font-weight: 1000; letter-spacing: 1px; color: var(--warm-white); }
.ttl p { font-size: 11px; font-weight: 800; color: var(--text-secondary); }
.balance {
  display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 12px;
  font-weight: 1000; font-size: 16px; color: var(--gold); background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 220, 150, 0.18);
}

.strip {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px;
  background: rgba(20, 12, 6, 0.72); border: 1px solid rgba(255, 220, 150, 0.14);
}
.en { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 3px; font-weight: 1000; color: var(--warm-white); font-size: 14px; }
.en small { color: var(--text-secondary); font-size: 11px; }
.hist { flex: 1; min-width: 0; display: flex; gap: 4px; overflow: hidden; justify-content: flex-end; }
.hist i { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.25); }
.hist i:first-child { width: 22px; height: 22px; border-color: #ffe27a; box-shadow: 0 0 6px rgba(255, 220, 100, 0.7); }
.hist i.red { background: #d3262b; }
.hist i.black { background: #1c1a22; }
.hist i.green { background: #1faa4c; }

.wheel-box { display: grid; place-items: center; padding: 4px 0; }
.wheel-wrap { position: relative; width: min(86vw, 340px); aspect-ratio: 1; }
.wheel { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; user-select: none; }
.rotor { filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.55)); will-change: transform; }
.gust {
  position: absolute; width: 7%; height: 1.5%; border-radius: 99px; pointer-events: none;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 250, 235, 0.95));
  box-shadow: 0 0 6px rgba(255, 245, 220, 0.8);
}
.egg {
  position: absolute; width: 5%; height: auto; pointer-events: none;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 4px rgba(255, 240, 200, 0.6));
}
/* В центре барабана яйцо мягко светится. */
.egg.mid { animation: egg-glow 1.8s ease-in-out infinite; }
@keyframes egg-glow {
  0%, 100% { filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 6px rgba(255, 220, 120, 0.6)); }
  50% { filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 16px rgba(255, 215, 90, 1)); }
}
.center {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 52%;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-align: center; pointer-events: none;
}
.below { display: flex; align-items: center; gap: 6px; transform: translateY(68px); }
.center b { font-size: 22px; font-weight: 1000; line-height: 1; text-shadow: 0 3px 0 rgba(0, 0, 0, 0.6); animation: pop 0.35s ease both; }
.center b.won { color: #9dff7a; }
.center b.lost { color: #ff7a66; }
.res-chip { padding: 1px 8px; border-radius: 99px; font-weight: 1000; font-size: 11px; color: #fff; border: 2px solid rgba(255, 255, 255, 0.5); }
.res-chip.red { background: #d3262b; }
.res-chip.black { background: #1c1a22; }
.res-chip.green { background: #1faa4c; }
.idle-txt { transform: translateY(68px); font-size: 14px; font-weight: 900; color: #ffe6a8; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6); }
.spin-txt { font-size: 34px; animation: spin 1s linear infinite; }

.panel {
  display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 16px;
  background: linear-gradient(180deg, rgba(52, 33, 17, 0.95), rgba(26, 16, 8, 0.96));
  border: 2px solid rgba(160, 108, 52, 0.75); box-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
}
.label { text-align: center; font-size: 12px; font-weight: 1000; letter-spacing: 0.5px; color: #e8cf9e; }
.amount-box { display: grid; grid-template-columns: 50px 1fr 50px; gap: 8px; align-items: center; }
.sq {
  height: 46px; border-radius: 12px; color: #3a2108; font-size: 28px; font-weight: 1000; line-height: 1;
  background: linear-gradient(180deg, #ffe17a, var(--gold)); box-shadow: 0 3px 0 var(--gold-dark);
}
.sq:disabled { opacity: 0.4; }
.amount-box label {
  height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 220, 150, 0.16); padding: 0 10px;
}
.amount-box input {
  width: 100%; max-width: 120px; min-width: 0; border: 0; outline: 0; text-align: center;
  color: var(--warm-white); background: transparent; font: inherit; font-size: 26px; font-weight: 1000;
}
.chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.chips button {
  height: 36px; border-radius: 10px; color: var(--cream); font-size: 15px; font-weight: 1000;
  background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 220, 150, 0.18);
}
.chips button.on { color: #3a2108; background: linear-gradient(180deg, #ffe17a, var(--gold)); border-color: var(--gold-dark); }
.chips button:disabled:not(.on) { opacity: 0.4; }

.bets { display: grid; grid-template-columns: 1fr 0.9fr 1fr; gap: 8px; margin-top: 2px; }
.bet {
  height: 64px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  color: #fff; font-weight: 1000; border: 2px solid rgba(255, 255, 255, 0.25);
  transition: transform 0.1s;
}
.bet span { font-size: 13px; letter-spacing: 0.5px; }
.bet b { font-size: 22px; line-height: 1; }
.bet.red { background: linear-gradient(180deg, #ff5a4a, #b8141a); box-shadow: 0 4px 0 #6e0a0d; }
.bet.black { background: linear-gradient(180deg, #4a4655, #141219); box-shadow: 0 4px 0 #000; }
.bet.green { background: linear-gradient(180deg, #4fe07a, #138a3a); box-shadow: 0 4px 0 #0b4d20; }
.bet.on { border-color: #ffe27a; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.6), 0 0 14px rgba(255, 220, 100, 0.7); }
.bet:active:not(:disabled) { transform: translateY(2px); }
.bet:disabled { opacity: 0.5; }
.cost { display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 800; color: var(--text-secondary); }

@keyframes pop { from { transform: scale(0.6); opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
