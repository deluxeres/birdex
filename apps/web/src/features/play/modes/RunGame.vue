<script setup lang="ts">
// Chicken Flight: виртуальные яйца -> серверная сессия -> collect/crash решает API.
// Сцена: случайный фон crash1..3 (чуть заблюрен), жёлтый график множителя, курица летит по линии,
// снизу её подталкивает оранжевый "ветер". Оси растут вместе с полётом.
import { computed, onMounted } from 'vue'
import { useRunGame } from './useRunGame'
import { useGameStore } from '@/stores/game'
import { ASSETS } from '@/config/assets'
import { flightElapsedForMultiplier, flightMultiplierAt } from '@/economy/chickenFlight'
import { formatNumber } from '@/economy/format'
import EggIcon from '@/components/EggIcon.vue'
import ChickenAvatar from '@/components/ChickenAvatar.vue'
import EnergyIcon from '@/components/EnergyIcon.vue'
import { ECONOMY } from '@/config/economy'

const emit = defineEmits<{ back: [] }>()
const game = useGameStore()
const g = useRunGame()

const bg = ASSETS.crashBackgrounds[Math.floor(Math.random() * ASSETS.crashBackgrounds.length)]
const chickenKey = computed(() => game.displayedChicken?.key ?? game.chickens?.[0]?.key ?? 'farm_hen')

const busy = computed(() => g.state.value === 'FLYING' || g.state.value === 'COLLECTING' || g.state.value === 'STARTING')
const flying = computed(() => g.state.value === 'FLYING' || g.state.value === 'COLLECTING')
const net = computed(() => g.settledReward.value - g.settledAmount.value)
const X_PRESETS = [1.5, 2, 3, 5]

function fmtX(v: number) {
  return `${v.toFixed(2)}x`
}

function back() {
  if (busy.value) return
  emit('back')
}

// ---------- График ----------
const VW = 340
const VH = 250
const PL = 34 // слева место под подписи x
const PR = 22
const PT = 74 // сверху место под большой множитель
const PB = 26
const plotW = VW - PL - PR
const plotH = VH - PT - PB

/** Прошедшие секунды полёта (для завершённого — секунды до множителя, на котором закончился). */
const seconds = computed(() => flightElapsedForMultiplier(g.currentMultiplier.value) / 1000)

function niceStep(raw: number) {
  for (const s of [0.5, 1, 2, 5, 10, 20, 25, 50]) if (raw <= s) return s
  return 100
}

const tMax = computed(() => Math.max(20, Math.ceil((seconds.value * 1.15) / 5) * 5))
const mMax = computed(() => Math.max(4, Math.ceil(g.currentMultiplier.value * 1.3)))
const yStep = computed(() => niceStep((mMax.value - 1) / 4))
const xStep = computed(() => Math.max(5, niceStep(tMax.value / 4)))

const sx = (t: number) => PL + (t / tMax.value) * plotW
const sy = (m: number) => PT + plotH - ((m - 1) / (mMax.value - 1)) * plotH

const yTicks = computed(() => {
  const out: number[] = []
  for (let m = 1; m <= mMax.value + 1e-6; m += yStep.value) out.push(Math.round(m * 100) / 100)
  return out
})
const xTicks = computed(() => {
  const out: number[] = []
  for (let t = 0; t <= tMax.value + 1e-6; t += xStep.value) out.push(t)
  return out
})

/** Точки кривой от 0 до текущего времени. */
const curve = computed(() => {
  const s = seconds.value
  const n = 48
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = (s * i) / n
    pts.push([sx(t), sy(i === n ? g.currentMultiplier.value : flightMultiplierAt(t * 1000))])
  }
  return pts
})
const linePath = computed(() => curve.value.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '))
const areaPath = computed(() => {
  const pts = curve.value
  const last = pts[pts.length - 1]
  return `${linePath.value} L${last[0].toFixed(1)} ${(PT + plotH).toFixed(1)} L${PL} ${PT + plotH} Z`
})
/** Точки на линии в моменты делений по времени. */
const dots = computed(() => xTicks.value.filter((t) => t > 0 && t < seconds.value).map((t) => [sx(t), sy(flightMultiplierAt(t * 1000))]))

const tip = computed(() => curve.value[curve.value.length - 1])
const tipStyle = computed(() => ({
  left: (tip.value[0] / VW) * 100 + '%',
  top: (tip.value[1] / VH) * 100 + '%',
}))

const bigClass = computed(() => ({
  crashed: g.state.value === 'CRASHED',
  won: g.state.value === 'COLLECTED',
  hot: g.currentMultiplier.value >= 5,
}))

/** Лента сверху: текущий множитель (жёлтый) + прошлые полёты. */
const strip = computed(() => {
  const items = g.history.value.map((h) => ({
    id: h.id,
    x: h.multiplier,
    // Краш — красный, забрал — зелёный, забрал от 2.5x — золотой.
    kind: h.status === 'CRASHED' ? 'lost' : h.multiplier >= 2.5 ? 'gold' : 'won',
  }))
  if (flying.value) items.unshift({ id: 'now', x: g.currentMultiplier.value, kind: 'now' })
  return items.slice(0, 9)
})

onMounted(g.loadActive)
</script>

<template>
  <div class="screen flight" :class="{ flying, crashed: g.state.value === 'CRASHED' }">
    <div class="bgimg" :style="{ backgroundImage: `url(${bg})` }" />
    <div class="bgdim" />

    <div class="topbar">
      <button class="back" :disabled="busy" @click="back">‹</button>
      <div class="ttl">
        <h1>CHICKEN FLIGHT</h1>
        <p>Virtual Eggs only</p>
      </div>
      <span class="balance"><EggIcon :size="20" /> {{ formatNumber(g.balance.value) }}</span>
    </div>

    <div v-if="strip.length" class="strip">
      <b v-for="h in strip" :key="h.id" :class="h.kind">{{ fmtX(h.x) }}</b>
    </div>

    <section class="scene">
      <div class="scene-bg" :style="{ backgroundImage: `url(${bg})` }" />
      <svg class="chart" :viewBox="`0 0 ${VW} ${VH}`" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="cf-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffd23f" stop-opacity="0.32" />
            <stop offset="1" stop-color="#ffd23f" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line v-for="m in yTicks" :key="'gy' + m" class="grid" :x1="PL" :x2="VW - PR" :y1="sy(m)" :y2="sy(m)" />
        <line v-for="t in xTicks" :key="'gx' + t" class="grid" :x1="sx(t)" :x2="sx(t)" :y1="PT" :y2="PT + plotH" />
        <line class="axis" :x1="PL" :x2="PL" :y1="PT - 10" :y2="PT + plotH" />
        <line class="axis" :x1="PL" :x2="VW - PR + 6" :y1="PT + plotH" :y2="PT + plotH" />
        <circle v-for="m in yTicks" :key="'ty' + m" class="tick" :cx="PL" :cy="sy(m)" r="2.2" />
        <circle v-for="t in xTicks" :key="'tx' + t" class="tick" :cx="sx(t)" :cy="PT + plotH" r="2.2" />
        <path class="area" :d="areaPath" />
        <path class="line-glow" :d="linePath" />
        <path class="line" :d="linePath" />
        <circle v-for="(d, i) in dots" :key="'d' + i" class="dot" :cx="d[0]" :cy="d[1]" r="3.6" />
        <circle class="dot" :cx="PL" :cy="sy(1)" r="3.6" />
        <circle class="dot tipdot" :cx="tip[0]" :cy="tip[1]" r="4.6" />
      </svg>

      <span v-for="m in yTicks" :key="'ly' + m" class="ylab" :style="{ top: (sy(m) / VH) * 100 + '%', right: (1 - (PL - 6) / VW) * 100 + '%' }">{{ m }}x</span>
      <span v-for="t in xTicks" :key="'lx' + t" class="xlab" :style="{ left: (sx(t) / VW) * 100 + '%' }">{{ t }}s</span>

      <div class="mult" :class="bigClass">{{ fmtX(g.currentMultiplier.value) }}</div>
      <div v-if="g.state.value === 'CRASHED'" class="big-sub lost">CRASHED</div>
      <div v-else-if="g.state.value === 'COLLECTED'" class="big-sub won">+{{ formatNumber(net) }} <EggIcon :size="20" /></div>
      <div v-else-if="g.milestone.value" class="big-sub ms">{{ g.milestone.value }}</div>

      <div class="bird" :style="tipStyle" :class="{ fall: g.state.value === 'CRASHED' }">
        <div v-if="flying" class="wind">
          <i v-for="n in 12" :key="n" :style="{ '--i': n }" />
        </div>
        <div class="bird-img"><ChickenAvatar :chicken-key="chickenKey" :size="70" :idle="false" /></div>
      </div>
    </section>

    <section class="panel">
      <template v-if="!flying">
        <div class="label">RUN AMOUNT</div>
        <div class="amount-box">
          <button class="sq" :disabled="busy" @click="g.step(-25)">−</button>
          <label>
            <EggIcon :size="24" />
            <input
              :value="g.amount.value"
              inputmode="numeric"
              pattern="[0-9]*"
              aria-label="Run amount"
              :disabled="busy"
              @input="g.setCustomAmount(($event.target as HTMLInputElement).value)"
            />
          </label>
          <button class="sq" :disabled="busy" @click="g.step(25)">+</button>
        </div>
        <div class="chips">
          <button v-for="p in g.CONFIG.presets" :key="p" :class="{ on: g.amount.value === p }" :disabled="busy || p > g.balance.value" @click="g.setAmount(p)">
            {{ p }}
          </button>
        </div>
        <div class="label">AUTO COLLECT X</div>
        <div class="chips">
          <button v-for="x in X_PRESETS" :key="x" :class="{ on: g.targetMultiplier.value === x }" :disabled="busy" @click="g.setTargetMultiplier(x)">
            {{ x }}x
          </button>
        </div>

        <button
          v-if="g.state.value === 'COLLECTED' || g.state.value === 'CRASHED'"
          class="gold-btn"
          @click="g.playAgain"
        >
          {{ g.state.value === 'COLLECTED' ? 'PLAY AGAIN' : 'TRY AGAIN' }}
        </button>
        <button v-else class="gold-btn" :disabled="!g.canLaunch.value || g.state.value === 'STARTING'" @click="g.launch">
          <EggIcon :size="30" /> PLAY {{ formatNumber(g.amount.value) }}
          <span class="en-cost"><EnergyIcon mode="run" color="#ffc629" :size="16" />{{ ECONOMY.modes.run.playCost }}</span>
        </button>
        <p v-if="g.state.value === 'IDLE' && g.amount.value > g.balance.value" class="blocked">
          Need at least {{ formatNumber(g.amount.value) }} eggs to launch.
        </p>
        <p v-else-if="g.state.value === 'IDLE' && g.balance.value < g.CONFIG.minAmount" class="blocked">
          Need at least {{ formatNumber(g.CONFIG.minAmount) }} eggs to play.
        </p>
      </template>

      <template v-else>
        <div class="run-stats">
          <span>RUN <b><EggIcon :size="18" /> {{ formatNumber(g.amount.value) }}</b></span>
          <span>AUTO <b>{{ g.targetMultiplier.value }}x</b></span>
        </div>
        <button class="gold-btn huge" :disabled="g.state.value === 'COLLECTING'" @click="g.collect">
          <EggIcon :size="34" /> COLLECT {{ formatNumber(g.currentReward.value) }}
        </button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.flight {
  position: relative; z-index: 1; flex: 1; min-height: 0; gap: 8px;
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 14px); overflow: visible;
}
.flying { padding-bottom: calc(var(--safe-bottom) + 14px); }
/* Фон режима: случайный crash1..3, чуть заблюрен. */
.bgimg {
  position: fixed; inset: -12px; z-index: -2; background-size: cover; background-position: center bottom;
  filter: blur(6px) brightness(0.7); transform: scale(1.05);
}
.bgdim { position: fixed; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(10, 6, 3, 0.25), rgba(10, 6, 3, 0.55)); }

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
.ttl h1 { white-space: nowrap; font-size: 18px; font-weight: 1000; letter-spacing: 0.5px; color: var(--warm-white); }
.ttl p { font-size: 11px; font-weight: 800; color: var(--text-secondary); }
.balance {
  display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 12px;
  font-weight: 1000; font-size: 16px; color: var(--gold); background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 220, 150, 0.18);
}

/* Лента множителей */
.strip {
  display: flex; gap: 5px; overflow-x: auto; padding: 6px; border-radius: 12px; scrollbar-width: none;
  background: rgba(20, 12, 6, 0.72); border: 1px solid rgba(255, 220, 150, 0.14);
}
.strip::-webkit-scrollbar { display: none; }
.strip b {
  flex: 0 0 auto; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: 900; font-variant-numeric: tabular-nums;
  color: var(--cream); background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14);
}
.strip b.now { color: #fff; border-color: rgba(255, 255, 255, 0.55); background: rgba(255, 255, 255, 0.14); animation: live 1s ease-in-out infinite alternate; }
.strip b.won { color: #9dff7a; border-color: rgba(120, 255, 90, 0.45); background: rgba(40, 90, 20, 0.4); }
.strip b.gold { color: #3a2108; border-color: var(--gold-dark); background: linear-gradient(180deg, #ffe17a, var(--gold)); box-shadow: 0 0 8px rgba(255, 200, 60, 0.5); }
@keyframes live { to { background: rgba(255, 255, 255, 0.26); } }
.strip b.lost { color: #ff8b78; border-color: rgba(255, 110, 90, 0.4); background: rgba(110, 25, 15, 0.35); }

/* Сцена с графиком */
.scene {
  position: relative; width: 100%; aspect-ratio: 340 / 250; flex: 0 0 auto; overflow: hidden; border-radius: 18px;
  border: 2px solid rgba(255, 205, 90, 0.75);
  background: #101a2c;
  box-shadow: 0 0 18px rgba(255, 190, 60, 0.25);
}
/* Фон сцены: тот же случайный crash-фон, блюр ~15%. */
.scene-bg {
  position: absolute; inset: -6px; background-size: cover; background-position: center 70%;
  filter: blur(1.5px) brightness(0.85); transform: scale(1.02);
}
.scene::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.45); pointer-events: none; }
.chart { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.grid { stroke: rgba(255, 255, 255, 0.09); stroke-width: 1; vector-effect: non-scaling-stroke; }
.axis { stroke: #ffd23f; stroke-width: 2; vector-effect: non-scaling-stroke; opacity: 0.9; }
.tick { fill: #ffe27a; }
.area { fill: url(#cf-area); }
.line-glow { fill: none; stroke: rgba(255, 200, 50, 0.45); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; filter: blur(3px); vector-effect: non-scaling-stroke; }
.line { fill: none; stroke: #ffd84a; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.dot { fill: #fff6c8; stroke: #ffb52e; stroke-width: 1.5; }
.tipdot { fill: #fff; filter: drop-shadow(0 0 4px #ffd23f); }
.crashed .line, .crashed .dot { stroke: #ff6a4a; }
.crashed .line-glow { stroke: rgba(255, 80, 50, 0.45); }

.ylab, .xlab {
  position: absolute; font-size: 12px; font-weight: 900; color: #fff3cf; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none; font-variant-numeric: tabular-nums;
}
.ylab { transform: translateY(-50%); }
.xlab { bottom: 1.5%; transform: translateX(-50%); font-size: 11px; }

.mult {
  position: absolute; left: 50%; top: 5%; transform: translateX(-50%); z-index: 3;
  font-size: clamp(44px, 15vw, 70px); font-weight: 1000; line-height: 1; letter-spacing: -1px; color: #fff3c4;
  background: linear-gradient(180deg, #fffbe6 10%, #ffd65a 60%, #f0a91c); -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 3px 0 #6a3a10) drop-shadow(0 0 14px rgba(255, 200, 60, 0.55));
  font-variant-numeric: tabular-nums; pointer-events: none;
}
.mult.hot { filter: drop-shadow(0 3px 0 #6a3a10) drop-shadow(0 0 22px rgba(255, 170, 40, 0.9)); }
.mult.crashed { background: linear-gradient(180deg, #ffd0c4, #ff5a3c 70%); -webkit-background-clip: text; background-clip: text; filter: drop-shadow(0 3px 0 #5a1208); }
.mult.won { background: linear-gradient(180deg, #eaffd8, #7cf04a 70%); -webkit-background-clip: text; background-clip: text; filter: drop-shadow(0 3px 0 #1d5212) drop-shadow(0 0 14px rgba(120, 255, 90, 0.5)); }
.big-sub {
  position: absolute; left: 50%; top: 31%; transform: translateX(-50%); z-index: 3; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: 99px; font-size: 14px; font-weight: 1000; animation: pop 0.35s ease both;
}
.big-sub.lost { color: #fff; background: #c8321e; box-shadow: 0 3px 0 #6e140a; }
.big-sub.won { color: #1d3a08; background: linear-gradient(180deg, #d4ff9c, #7ae04a); box-shadow: 0 3px 0 #2e6a14; }
.big-sub.ms { color: #3a2108; background: linear-gradient(180deg, #fff4a6, var(--gold)); box-shadow: 0 3px 0 var(--gold-dark); }

/* Курица на кончике линии */
.bird { position: absolute; z-index: 2; width: 0; height: 0; pointer-events: none; }
.bird-img {
  position: absolute; left: -24px; top: -62px; width: 72px; height: 72px;
  transform-origin: 50% 80%;
  filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.45));
}
.flying .bird-img { animation: bob 0.9s ease-in-out infinite alternate; }
.bird.fall .bird-img { animation: fall 0.9s cubic-bezier(0.5, 0, 0.9, 0.6) forwards; }

/* Оранжевый ветер снизу — толкает курицу вверх по линии */
.wind { position: absolute; left: 0; top: 0; transform: rotate(-18deg); }
.wind i {
  position: absolute; left: -6px; top: -6px; width: 34px; height: 5px; border-radius: 99px;
  background: linear-gradient(90deg, rgba(255, 110, 10, 0), #ff8c1a 50%, #ffd65a);
  box-shadow: 0 0 8px rgba(255, 140, 30, 0.95);
  opacity: 0; animation: gust 0.55s linear infinite; animation-delay: calc(var(--i) * -0.046s);
}
.wind i:nth-child(odd) { width: 22px; height: 4px; }
.wind i:nth-child(3n) { background: radial-gradient(circle, #fff3b0, #ff8a1e 55%, transparent 70%); width: 9px; height: 9px; box-shadow: 0 0 10px #ff9a2a; }
/* Струи ветра вылетают из-под курицы назад-вниз, будто её несёт поток. */
@keyframes gust {
  0% { opacity: 0; transform: translate(4px, 4px) scaleX(0.5); }
  12% { opacity: 1; }
  100% { opacity: 0; transform: translate(-78px, calc(10px + (var(--i) - 6) * 3.5px)) scaleX(1.25); }
}
@keyframes bob { from { transform: translateY(2px); } to { transform: translateY(-4px); } }
@keyframes fall { to { transform: translate(18px, 150px) rotate(140deg); opacity: 0.2; } }
@keyframes pop { from { transform: translateX(-50%) scale(0.6); opacity: 0; } }

/* Панель ставок */
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
  height: 38px; border-radius: 10px; color: var(--cream); font-size: 15px; font-weight: 1000;
  background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 220, 150, 0.18);
}
.chips button.on { color: #3a2108; background: linear-gradient(180deg, #ffe17a, var(--gold)); border-color: var(--gold-dark); box-shadow: 0 2px 0 var(--gold-dark); }
.chips button:disabled:not(.on) { opacity: 0.4; }
.gold-btn {
  margin-top: 4px; height: 58px; border-radius: 16px; display: flex; align-items: center; justify-content: center; gap: 10px;
  font-size: 22px; font-weight: 1000; letter-spacing: 0.5px; color: #3a2108;
  background: linear-gradient(180deg, #fff0a0, #ffcf3a 45%, #f0a51a);
  border: 2px solid #fff3b0; box-shadow: 0 4px 0 #9a5a0a, 0 0 18px rgba(255, 200, 60, 0.45);
}
.gold-btn.huge { height: 64px; font-size: 25px; }
.gold-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #9a5a0a; }
.gold-btn:disabled { opacity: 0.5; }
.en-cost {
  display: inline-flex; align-items: center; gap: 1px; padding: 2px 8px 2px 4px; border-radius: 99px;
  font-size: 15px; background: rgba(58, 33, 8, 0.25);
}
.blocked { text-align: center; color: #ffb09d; font-size: 12px; font-weight: 800; }
.run-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.run-stats > span {
  display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px; border-radius: 12px;
  color: var(--text-secondary); font-size: 11px; font-weight: 900; background: rgba(0, 0, 0, 0.3);
}
.run-stats b { display: inline-flex; align-items: center; gap: 4px; color: var(--warm-white); font-size: 18px; }

@media (prefers-reduced-motion: reduce) {
  .wind i, .flying .bird-img { animation: none; }
}
</style>
