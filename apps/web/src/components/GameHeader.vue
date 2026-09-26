<script setup lang="ts">
import CoinIcon from '@/components/CoinIcon.vue'
import BirdPointsIcon from '@/components/BirdPointsIcon.vue'
// Верх экрана: профиль, игровая экономика и сезонные BIRD Points.
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { levelProgress } from '@/economy/progression'
import { formatNumber } from '@/economy/format'
import { seasonRank } from '@/economy/season'
import { autoAvatarKey } from '@/economy/autoAvatar'
import ResourcePill from './ResourcePill.vue'
import EggIcon from './EggIcon.vue'
import DailyRewardTile from './DailyRewardTile.vue'
import HeaderTile from './HeaderTile.vue'
import { ASSETS } from '@/config/assets'
import { playSound } from '@/services/audio'
import type { SheetId } from '@/types/game'
import ProgressBar from './ProgressBar.vue'
import PlayerAvatar from './PlayerAvatar.vue'
import { t } from '@/i18n'

const game = useGameStore()
const ui = useUiStore()
const rank = computed(() => seasonRank(game.season?.points ?? 0))

/** Открыть окно шапки со звуком. */
function open(sheet: SheetId, sound: 'openPanel' | 'openCalendar' | 'settings') {
  playSound(sound, 0.7)
  ui.openSheet(sheet)
}

</script>

<template>
  <header v-if="game.state" class="header">
    <div class="top row">
      <div class="profile row">
        <PlayerAvatar :chicken-key="autoAvatarKey(game.profile?.level ?? 1)" :size="46" />
        <div class="info">
          <div class="farm-name">{{ game.profile?.farmName }}</div>
          <div class="lvl">{{ t('header.level', { n: game.profile?.level ?? 1 }) }}</div>
          <ProgressBar :value="levelProgress(game.profile?.xp ?? 0)" :max="1" />
        </div>
      </div>
      <div class="pills">
        <ResourcePill :value="game.balance?.coins ?? 0" plus @plus="ui.setTab('market')">
          <template #icon><CoinIcon :size="22" /></template>
        </ResourcePill>
        <ResourcePill :value="game.balance?.eggs ?? 0" :max="game.balance?.storageCapacity">
          <template #icon><EggIcon :size="22" /></template>
        </ResourcePill>
      </div>
      <button class="gear" :aria-label="t('settings.title')" @click="open('settings', 'settings')">⚙️</button>
    </div>

    <div class="quick">
      <DailyRewardTile @open="open('reward', 'openCalendar')" />
      <HeaderTile
        :src="ASSETS.ui.rating"
        :label="t('header.rating')"
        fallback-icon="🏆"
        @click="open('rating', 'openPanel')"
      />
      <HeaderTile
        :src="ASSETS.ui.friends"
        :label="t('header.friends')"
        fallback-icon="👥"
        @click="open('friends', 'openPanel')"
      />
    </div>

    <button class="season-card" @click="ui.setTab('season')">
      <span class="season-name">🏆 {{ t('season.seasonN', { n: game.season?.id ?? 1 }) }}</span>
      <span class="season-points"><BirdPointsIcon :size="18" /> {{ formatNumber(game.season?.points ?? 0) }}</span>
      <span class="season-rank">#{{ formatNumber(rank) }}</span>
    </button>
  </header>
</template>

<style scoped>
.header {
  position: sticky; top: 0; z-index: 20;
  padding: calc(var(--safe-top) + 8px) 12px 8px;
  background: linear-gradient(180deg, rgba(27, 19, 13, 0.85) 0%, rgba(27, 19, 13, 0.4) 70%, transparent);
}
.top { gap: 8px; }
.profile { text-align: left; gap: 8px; min-width: 0; flex: 1; }
.ava {
  width: 44px; height: 44px; border-radius: 50%; font-size: 26px;
  display: grid; place-items: center; background: var(--surface-wood); border: 2px solid var(--gold);
}
.info { min-width: 0; flex: 1; max-width: 150px; display: flex; flex-direction: column; gap: 2px; }
.farm-name { font-weight: 900; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lvl { font-size: 11px; color: var(--text-secondary); }
.pills { display: flex; flex-direction: row; gap: 6px; align-items: center; justify-content: flex-end; min-width: 0; }
.pills :deep(.pill) { min-width: 0; }
.gear { font-size: 22px; padding: 4px; }
.quick {
  --tile-ratio: 600 / 225;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; align-items: start;
}
.season-card {
  width: 100%; margin-top: 7px; padding: 9px 10px; border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.5); border: 2px solid var(--gold-dark);
  display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;
  text-align: left; font-weight: 900;
}
.season-name { color: var(--text-primary); }
.season-points { color: var(--gold); display: inline-flex; align-items: center; gap: 4px; }
.season-rank { color: var(--text-secondary); font-size: 13px; }
</style>
