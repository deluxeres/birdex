<script setup lang="ts">
import { computed } from 'vue'
import FarmBackdrop from '@/components/FarmBackdrop.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import BirdPointsIcon from '@/components/BirdPointsIcon.vue'
import { formatNumber } from '@/economy/format'
import { formatSeasonLeft, seasonRank, seasonTopPercent, SEASON_MS } from '@/economy/season'
import { useGameStore } from '@/stores/game'
import { t } from '@/i18n'

const game = useGameStore()
const points = computed(() => game.season?.points ?? 0)
const rank = computed(() => seasonRank(points.value))
const top = computed(() => seasonTopPercent(rank.value).toFixed(1))
const leftMs = computed(() => Math.max(0, (game.season?.endsAt ?? game.now) - game.now))
const elapsed = computed(() => SEASON_MS - leftMs.value)
</script>

<template>
  <FarmBackdrop />
  <div class="screen season">
    <h1 class="screen-title">🏆 {{ t('season.title') }}</h1>

    <section class="card hero">
      <div class="season-id">{{ t('season.seasonN', { n: game.season?.id ?? 1 }) }}</div>
      <div class="points"><BirdPointsIcon :size="40" /> {{ formatNumber(points) }}</div>
      <div class="muted">{{ t('season.eligibility') }}</div>
      <ProgressBar :value="elapsed" :max="SEASON_MS" color="var(--gold)" />
      <div class="row meta">
        <span>{{ t('season.endsIn') }} {{ formatSeasonLeft(leftMs) }}</span>
        <span>#{{ formatNumber(rank) }}</span>
      </div>
    </section>

    <section class="grid">
      <div class="card stat">
        <span class="muted">{{ t('season.rank') }}</span>
        <strong>#{{ formatNumber(rank) }}</strong>
      </div>
      <div class="card stat">
        <span class="muted">{{ t('season.top') }}</span>
        <strong>{{ top }}%</strong>
      </div>
    </section>

    <section class="card chain">
      <div>🐔 FARM</div>
      <div>🥚 EGGS</div>
      <div>🪙 COINS</div>
      <div>📈 FARM GROWTH</div>
      <div class="bp-row"><BirdPointsIcon :size="18" /> BIRD POINTS</div>
      <div>🏆 SNAPSHOT</div>
      <div>$BIRD rewards</div>
    </section>

    <section class="card note">
      <strong>{{ t('season.snapshotTitle') }}</strong>
      <p class="muted">{{ t('season.snapshotText') }}</p>
    </section>
  </div>
</template>

<style scoped>
.points { display: flex; align-items: center; justify-content: center; gap: 8px; }
.bp-row { display: inline-flex; align-items: center; gap: 4px; }
.season { position: relative; z-index: 1; gap: 10px; }
.hero { padding: 14px; display: flex; flex-direction: column; gap: 9px; }
.season-id { font-size: 12px; font-weight: 900; color: var(--text-secondary); }
.points { font-size: 34px; line-height: 1; font-weight: 900; color: var(--gold); }
.meta { font-size: 12px; font-weight: 900; color: var(--text-secondary); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat { padding: 12px; display: flex; flex-direction: column; gap: 4px; }
.stat strong { font-size: 22px; color: var(--gold); }
.chain { padding: 12px; display: flex; flex-direction: column; gap: 6px; font-weight: 900; }
.note { padding: 12px; }
.note p { margin: 6px 0 0; font-size: 12px; line-height: 1.35; }
</style>
