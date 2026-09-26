<script setup lang="ts">
import EnergyIcon from '@/components/EnergyIcon.vue'
// Энергия режима Play: сколько есть, когда следующая попытка и прокачка максимума за монеты.
// Покупки энергии нет — только прокачка: +50 за уровень, 300 → 1000, у каждого режима своя.
import CoinIcon from '@/components/CoinIcon.vue'
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { ECONOMY } from '@/config/economy'
import { energyUpgradeCost, energyMaxForLevel, ENERGY_MAX_LEVEL, msUntilPlayable } from '@/economy/energy'
import type { PlayMode } from '@/economy/modes'
import { formatNumber, formatDuration } from '@/economy/format'
import { playSound } from '@/services/audio'
import ProgressBar from '@/components/ProgressBar.vue'
import { t } from '@/i18n'

const props = withDefaults(defineProps<{ mode?: PlayMode; color?: string }>(), { mode: 'catch', color: 'var(--gold)' })
const game = useGameStore()

const extra = computed(() => (props.mode === 'fox' || props.mode === 'run' || props.mode === 'double' ? props.mode : null))
const level = computed(() =>
  extra.value ? (game.state?.modeEnergy?.[extra.value]?.level ?? 0) : (game.state?.energyLevel ?? 0),
)
const energy = computed(() => (extra.value ? game.modeEnergy(extra.value) : game.energy))
const max = computed(() => energyMaxForLevel(level.value))
const playCost = computed(() => (extra.value ? ECONOMY.modes[extra.value].playCost : ECONOMY.energy.playCost))
const maxed = computed(() => level.value >= ENERGY_MAX_LEVEL)
const cost = computed(() => energyUpgradeCost(level.value))
const nextMax = computed(() => energyMaxForLevel(level.value + 1))
const affordable = computed(() => (game.balance?.coins ?? 0) >= cost.value)
const waitMs = computed(() => msUntilPlayable(energy.value, max.value, playCost.value))
const tries = computed(() => Math.floor(energy.value / playCost.value))
const pendingId = computed(() => (extra.value ? `energy:${extra.value}` : 'energy'))

function upgrade() {
  if (!affordable.value) {
    playSound('error', 0.7)
    return
  }
  if (extra.value) game.upgradeModeEnergy(extra.value)
  else game.upgradeEnergy()
}
</script>

<template>
  <div class="card energy" :style="{ '--c': color }">
    <div class="row">
      <EnergyIcon :mode="mode" :color="color" :size="22" />
      <b>{{ formatNumber(energy) }} / {{ formatNumber(max) }}</b>
      <div class="spacer" />
      <span v-if="waitMs > 0" class="muted small">{{ t('play.nextTry', { time: formatDuration(waitMs) }) }}</span>
      <span v-else class="ok small">{{ t('play.tries', { n: tries }) }}</span>
    </div>
    <ProgressBar :value="energy" :max="max" :color="color" />
    <div class="muted small">{{ t('play.energyInfo', { cost: playCost, hours: ECONOMY.energy.refillHours }) }}</div>
    <!-- Кнопка прокачки цвета режима: Ловля — оранжевая, Лисы — красная, Бомбы — зелёная. -->
    <button v-if="!maxed" class="up" :class="{ off: !affordable }" :disabled="game.pending === pendingId" @click="upgrade">
      <EnergyIcon :mode="mode" color="#fff" :size="18" /> {{ formatNumber(max) }} → {{ formatNumber(nextMax) }} · <CoinIcon :size="16" /> {{ formatNumber(cost) }}
    </button>
    <div v-else class="muted small center">{{ t('play.energyMaxed') }}</div>
  </div>
</template>

<style scoped>
.energy { padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%; text-align: left; border-color: var(--c); }
.bolt { font-size: 20px; color: var(--c); text-shadow: 0 0 6px var(--c); }
.small { font-size: 12px; }
.ok { color: var(--green-success); font-weight: 900; }
.center { text-align: center; }
.up {
  height: 40px; border-radius: var(--radius-sm); font-weight: 900; font-size: 14px; color: #fff;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 72%, #fff), var(--c));
  box-shadow: 0 3px 0 color-mix(in srgb, var(--c) 60%, #000), inset 0 1px 0 rgba(255, 255, 255, 0.45);
}
.up:active:not(.off) { transform: translateY(2px); box-shadow: 0 1px 0 color-mix(in srgb, var(--c) 60%, #000); }
.up.off { filter: saturate(0.45) brightness(0.7); }
.up:disabled { opacity: 0.7; }
</style>
