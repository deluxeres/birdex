<script setup lang="ts">
import EnergyIcon from '@/components/EnergyIcon.vue'
// Меню Play: выбор режима. У каждого режима своя энергия и цена попытки.
// Ловля яиц — основная энергия (прокачка и покупка через "+"), Лисы и Бомбы — своя, восстанавливается за 8 ч.
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { ECONOMY } from '@/config/economy'
import { ASSETS } from '@/config/assets'
import { modeEnergyMax, type ExtraMode, type PlayMode } from '@/economy/modes'
import { formatNumber } from '@/economy/format'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import EggIcon from '@/components/EggIcon.vue'
import CoinIcon from '@/components/CoinIcon.vue'
import EnergyPanel from './EnergyPanel.vue'
import { t } from '@/i18n'

const emit = defineEmits<{ select: [mode: PlayMode] }>()
const game = useGameStore()
const ui = useUiStore()

const modeMax = (m: ExtraMode) => {
  const e = game.state?.modeEnergy?.[m]
  return e ? modeEnergyMax(e) : ECONOMY.energy.start
}

interface Card {
  mode: PlayMode
  color: string
  img?: string
  icon?: string
  energy: number
  max: number
  cost: number
  locked?: boolean
}

const cards = computed<Card[]>(() => [
  {
    mode: 'catch', color: '#ff9f1c', img: ASSETS.modes.catch,
    energy: game.energy, max: game.balance?.energyMax ?? ECONOMY.energy.start, cost: ECONOMY.energy.playCost,
  },
  {
    mode: 'fox', color: '#ff4d3d', img: ASSETS.modes.fox,
    energy: game.modeEnergy('fox'), max: modeMax('fox'), cost: ECONOMY.modes.fox.playCost,
  },
  {
    mode: 'run', color: '#ffc629', img: ASSETS.modes.run,
    energy: game.modeEnergy('run'), max: modeMax('run'), cost: ECONOMY.modes.run.playCost,
  },
  {
    mode: 'double', color: '#3ccf5a', img: ASSETS.modes.double,
    energy: game.modeEnergy('double'), max: modeMax('double'), cost: ECONOMY.modes.double.playCost,
  },
  { mode: 'puzzle', color: '#3aa0ff', icon: '🧩', energy: 0, max: 200, cost: 20, locked: true },
  { mode: 'hunt', color: '#b05bff', icon: '🗺️', energy: 0, max: 150, cost: 30, locked: true },
])

/** Режим, у которого раскрыта панель прокачки энергии ("+"). */
const energyOpen = ref<PlayMode | null>(null)
const shaking = ref<PlayMode | null>(null)

function play(c: Card) {
  if (c.locked) {
    playSound('error', 0.5)
    ui.toast(t('modes.soon'), 'info')
    return
  }
  if (c.energy < c.cost) {
    playSound('error', 0.7)
    haptics.error()
    ui.toast(t('errors.NO_ENERGY'), 'error')
    shaking.value = null
    requestAnimationFrame(() => (shaking.value = c.mode))
    return
  }
  playSound('click', 0.6)
  emit('select', c.mode)
}

function plus(c: Card) {
  playSound('click', 0.5)
  energyOpen.value = energyOpen.value === c.mode ? null : c.mode
}
</script>

<template>
  <div class="screen menu">
    <div class="card top row">
      <span class="res"><EggIcon :size="22" /> {{ formatNumber(game.balance?.eggs ?? 0) }}</span>
      <div class="spacer" />
      <span class="res"><CoinIcon :size="22" /> {{ formatNumber(game.balance?.coins ?? 0) }}</span>
    </div>

    <div class="head">
      <h1>{{ t('modes.title') }}</h1>
      <p>{{ t('modes.subtitle') }}</p>
    </div>

    <template v-for="c in cards" :key="c.mode">
      <div class="card mode-card" :class="{ locked: c.locked }" :style="{ '--c': c.color }">
        <div class="pic">
          <img v-if="c.img" :src="c.img" alt="" draggable="false" />
          <span v-else class="pic-icon">{{ c.icon }}</span>
          <span v-if="c.locked" class="lock">🔒</span>
        </div>
        <div class="info">
          <h2>{{ t(`modes.${c.mode}.title`) }}</h2>
          <p>{{ t(`modes.${c.mode}.text`) }}</p>
          <div v-if="!c.locked" class="energy row">
            <EnergyIcon :mode="c.mode" :color="c.color" :size="18" />
            <span class="num"><b>{{ formatNumber(c.energy) }}</b> / {{ formatNumber(c.max) }}</span>
          </div>
          <div v-else class="soon">{{ t('modes.soon') }}</div>
          <div v-if="!c.locked" class="bar-row">
            <div class="bar"><div class="fill" :style="{ width: Math.min(100, (c.energy / c.max) * 100) + '%' }" /></div>
            <button class="plus" :aria-label="t('modes.upgradeEnergy')" @click="plus(c)">+</button>
          </div>
        </div>
        <button
          class="go"
          :class="{ 'shake-x': shaking === c.mode, off: c.locked || c.energy < c.cost }"
          @animationend="shaking = null"
          @click="play(c)"
        >
          <template v-if="c.locked">🔒</template>
          <template v-else>
            <span class="go-main">▶ {{ t('modes.play') }}</span>
            <span class="go-cost"><EnergyIcon :mode="c.mode" :color="c.color" :size="15" />{{ c.cost }}</span>
          </template>
        </button>
      </div>
      <EnergyPanel v-if="energyOpen === c.mode" :mode="c.mode" :color="c.color" class="energy-panel" />
    </template>
  </div>
</template>

<style scoped>
.menu { position: relative; z-index: 1; gap: 10px; }
.top {
  padding: 8px 14px; font-weight: 900; font-size: 16px;
  background: rgba(0, 0, 0, 0.42); border-color: rgba(214, 160, 70, 0.7); backdrop-filter: blur(2px);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
.res { display: inline-flex; align-items: center; gap: 6px; }
.head { text-align: center; margin: 6px 0 2px; }
.head h1 { margin: 0; font-size: 34px; font-weight: 900; color: var(--warm-white); text-shadow: 0 3px 0 #6a3a16, 0 0 18px rgba(0, 0, 0, 0.6); }
.head p { margin: 2px 0 0; font-size: 13px; font-weight: 700; color: var(--cream); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }

.mode-card {
  display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 9px; align-items: center; padding: 8px;
  border: 2px solid #8a5d36; background: linear-gradient(180deg, rgba(58, 38, 22, 0.94), rgba(34, 22, 13, 0.96));
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 220, 160, 0.15);
}
.pic {
  position: relative; width: 92px; height: 84px; border-radius: 10px; overflow: hidden;
  border: 2px solid rgba(255, 210, 140, 0.35); background: linear-gradient(135deg, color-mix(in srgb, var(--c) 45%, #2a1d13), #1b130d);
  display: grid; place-items: center;
}
.pic img { width: 100%; height: 100%; object-fit: cover; }
.pic-icon { font-size: 40px; }
.locked .pic img, .locked .pic-icon { filter: grayscale(0.6) brightness(0.6); }
.lock { position: absolute; inset: 0; display: grid; place-items: center; font-size: 28px; background: rgba(0, 0, 0, 0.35); }
.info { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
h2 { margin: 0; font-size: 17px; font-weight: 900; color: var(--warm-white); }
.info p { margin: 0; font-size: 11px; line-height: 1.2; color: var(--text-secondary); }
.energy { gap: 4px; font-size: 13px; margin-top: 2px; }
.bolt { color: var(--c); text-shadow: 0 0 6px var(--c); }
.num b { color: var(--c); }
.bar-row { display: flex; align-items: center; gap: 6px; }
.bar { flex: 1; height: 8px; border-radius: 99px; background: rgba(0, 0, 0, 0.55); overflow: hidden; }
.fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 70%, #fff), var(--c)); transition: width 0.4s; }
.plus {
  width: 24px; height: 24px; flex: 0 0 auto; border-radius: 6px; font-weight: 900; font-size: 16px; line-height: 1;
  color: var(--gold); background: #3b2616; border: 2px solid var(--gold-dark);
}
.soon { font-size: 12px; font-weight: 900; color: var(--text-muted); margin-top: 4px; }
.go {
  width: 92px; height: 58px; padding: 0 6px; border-radius: 12px; white-space: nowrap; font-weight: 900; font-size: 15px; color: #4a2a05;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  background: linear-gradient(180deg, #ffe07a, var(--gold)); box-shadow: 0 4px 0 var(--gold-dark), inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.go:active:not(.off) { transform: translateY(3px); box-shadow: 0 1px 0 var(--gold-dark); }
.go.off { filter: saturate(0.5) brightness(0.8); }
.go .bolt { text-shadow: none; }
.go-cost { font-size: 13px; display: inline-flex; align-items: center; gap: 1px; opacity: 0.9; }
.locked .go { width: 58px; }
.energy-panel { margin: -4px auto 0; max-width: none; }
</style>
