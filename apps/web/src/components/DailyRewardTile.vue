<script setup lang="ts">
// Плашка ежедневной награды в шапке (картинка ui/calendar).
// На листке календаря — сегодняшнее число по Вашингтону,
// в тёмном окошке — таймер до следующей награды или "Забрать!".
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { ASSETS } from '@/config/assets'
import { rewardStatus, msUntilReward, effectiveStreakDay } from '@/economy/reward'
import { dayOfMonth } from '@/economy/dayClock'
import { formatDuration } from '@/economy/format'
import { t } from '@/i18n'

defineEmits<{ open: [] }>()
const game = useGameStore()
const imgFailed = ref(false)

const today = computed(() => dayOfMonth(game.now))
const ready = computed(() => !!game.state && rewardStatus(game.state.reward, game.now) === 'ready')
const streakDay = computed(() => (game.state ? effectiveStreakDay(game.state.reward, game.now) : 0))
const timer = computed(() => (game.state ? formatDuration(msUntilReward(game.state.reward, game.now)) : ''))
</script>

<template>
  <button class="tile" :class="{ ready, noimg: imgFailed }" :aria-label="t('reward.title')" @click="$emit('open')">
    <img v-if="!imgFailed" class="frame" :src="ASSETS.ui.calendar" alt="" draggable="false" @error="imgFailed = true" />
    <span class="date">{{ today }}</span>
    <span class="label">{{ t('header.dayN', { n: streakDay + 1 }) }}</span>
    <span class="slot">
      <span v-if="ready" class="claim">{{ t('header.claim') }}</span>
      <span v-else class="timer">{{ timer }}</span>
    </span>
    <span v-if="ready" class="dot" />
  </button>
</template>

<style scoped>
/* Координаты в % от картинки calendar.webp (600×223). */
.tile {
  position: relative; display: block; width: 100%;
  aspect-ratio: var(--tile-ratio); container-type: size;
  transition: transform 0.1s;
}
.tile:active { transform: scale(0.96); }
.frame { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
.noimg { background: var(--surface-dark); border: 2px solid var(--surface-wood); border-radius: var(--radius-md); }

.date {
  position: absolute; left: 8.3%; width: 20%; top: 40%; height: 32%;
  display: grid; place-items: center;
  font-weight: 900; font-size: max(13px, 30cqh); line-height: 1; color: #3a2414;
  font-variant-numeric: tabular-nums;
}
.label {
  position: absolute; left: 33%; right: 6%; top: 20%; height: 34%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: max(10px, 21cqh); color: var(--cream); white-space: nowrap;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
}
.slot {
  position: absolute; left: 33%; right: 6%; top: 60%; height: 24%;
  display: grid; place-items: center; overflow: hidden;
}
.timer {
  font-weight: 900; font-size: max(9px, 19cqh); color: var(--gold); letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.claim {
  font-weight: 900; font-size: max(9px, 19cqh); color: #ffe08a; text-transform: uppercase; letter-spacing: 0.04em;
  text-shadow: 0 0 6px rgba(245, 184, 46, 0.9);
  animation: pulse 1.2s ease-in-out infinite;
}
.tile.ready .frame { filter: drop-shadow(0 0 6px rgba(245, 184, 46, 0.55)); }
.dot {
  position: absolute; top: 4%; right: 2%; width: 12px; height: 12px; border-radius: 50%;
  background: var(--red-accent); box-shadow: 0 0 0 2px var(--background-dark);
}
@keyframes pulse { 50% { transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .claim { animation: none; } }
</style>
