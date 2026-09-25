<script setup lang="ts">
// Энергия для Play: сколько есть, когда хватит на попытку, прокачка максимума за монеты.
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { ECONOMY } from '@/config/economy'
import { energyUpgradeCost, energyMaxForLevel, ENERGY_MAX_LEVEL, msUntilPlayable } from '@/economy/energy'
import { formatNumber, formatDuration } from '@/economy/format'
import { playSound } from '@/services/audio'
import ProgressBar from '@/components/ProgressBar.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { t } from '@/i18n'

const game = useGameStore()

const level = computed(() => game.state?.energyLevel ?? 0)
const max = computed(() => game.balance?.energyMax ?? ECONOMY.energy.start)
const maxed = computed(() => level.value >= ENERGY_MAX_LEVEL)
const cost = computed(() => energyUpgradeCost(level.value))
const nextMax = computed(() => energyMaxForLevel(level.value + 1))
const affordable = computed(() => (game.balance?.coins ?? 0) >= cost.value)
const waitMs = computed(() => msUntilPlayable(game.energy, max.value))
const tries = computed(() => Math.floor(game.energy / ECONOMY.energy.playCost))

function upgrade() {
  if (!affordable.value) {
    playSound('error', 0.7)
    return
  }
  game.upgradeEnergy()
}
</script>

<template>
  <div class="card energy">
    <div class="row">
      <span class="bolt">⚡</span>
      <b>{{ formatNumber(game.energy) }} / {{ formatNumber(max) }}</b>
      <div class="spacer" />
      <span v-if="waitMs > 0" class="muted small">{{ t('play.nextTry', { time: formatDuration(waitMs) }) }}</span>
      <span v-else class="ok small">{{ t('play.tries', { n: tries }) }}</span>
    </div>
    <ProgressBar :value="game.energy" :max="max" color="var(--gold)" />
    <div class="muted small">{{ t('play.energyInfo', { cost: ECONOMY.energy.playCost, hours: ECONOMY.energy.refillHours }) }}</div>
    <PrimaryButton
      v-if="!maxed"
      small
      :variant="affordable ? 'green' : 'wood'"
      :loading="game.pending === 'energy'"
      @click="upgrade"
    >
      ⚡ {{ formatNumber(max) }} → {{ formatNumber(nextMax) }} · 🪙 {{ formatNumber(cost) }}
    </PrimaryButton>
    <div v-else class="muted small center">{{ t('play.energyMaxed') }}</div>
  </div>
</template>

<style scoped>
.energy { padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 360px; text-align: left; }
.bolt { font-size: 20px; }
.small { font-size: 12px; }
.ok { color: var(--green-success); font-weight: 900; }
.center { text-align: center; }
</style>
