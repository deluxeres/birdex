<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import type { TabId } from '@/types/game'
import { playSound } from '@/services/audio'
import { t } from '@/i18n'
import EggIcon from './EggIcon.vue'
import ChickenAvatar from './ChickenAvatar.vue'
import BirdPointsIcon from './BirdPointsIcon.vue'
import { ASSETS } from '@/config/assets'

const ui = useUiStore()

const TABS: { id: TabId; icon: string }[] = [
  { id: 'farm', icon: 'farm' },
  { id: 'play', icon: 'egg' },
  { id: 'chickens', icon: 'hen' },
  { id: 'shop', icon: 'shop' },
  { id: 'earn', icon: 'bp' },
  { id: 'season', icon: '🏆' },
]

function go(id: TabId) {
  playSound('click', 0.6)
  if (ui.tab !== id) ui.setTab(id)
}
</script>

<template>
  <nav class="nav" :class="{ hidden: ui.playing }">
    <button
      v-for="tab in TABS"
      :key="tab.id"
      class="item"
      :class="{ active: ui.tab === tab.id, play: tab.id === 'play' }"
      @click="go(tab.id)"
    >
      <span class="icon">
        <EggIcon v-if="tab.icon === 'egg'" :size="24" />
        <ChickenAvatar v-else-if="tab.icon === 'hen'" chicken-key="golden_hen" :size="30" :idle="false" />
        <img v-else-if="tab.icon === 'farm' || tab.icon === 'shop'" class="img" :src="ASSETS.ui[tab.icon]" alt="" draggable="false" />
        <BirdPointsIcon v-else-if="tab.icon === 'bp'" :size="28" />
        <template v-else>{{ tab.icon }}</template>
      </span>
      <span class="label">{{ t(`tabs.${tab.id}`) }}</span>
    </button>
  </nav>
</template>

<style scoped>
.nav {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
  padding: 6px 6px calc(6px + var(--safe-bottom));
  background: linear-gradient(180deg, #3b2616, #24170d);
  border-top: 2px solid var(--border-wood);
  transition: transform 0.25s ease;
}
/* Во время игры в Play меню уезжает вниз. */
.nav.hidden { transform: translateY(110%); pointer-events: none; }
.item {
  height: 56px; border-radius: var(--radius-sm);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  color: var(--text-secondary); transition: background 0.15s, transform 0.1s;
}
.item:active { transform: scale(0.94); }
.img { width: 30px; height: 30px; object-fit: contain; }
.icon { font-size: 22px; line-height: 1; height: 30px; display: flex; align-items: center; justify-content: center; }
.label { font-size: 11px; font-weight: 800; }
.item.active { background: linear-gradient(180deg, #ffcf5a, var(--gold)); color: #4a2a05; box-shadow: 0 3px 0 var(--gold-dark); }
/* Все иконки слегка покачиваются, каждая со своей задержкой — "живое" меню. */
.icon { animation: bob 2.4s ease-in-out infinite; }
.item:nth-child(2) .icon { animation-delay: -0.4s; }
.item:nth-child(3) .icon { animation-delay: -0.8s; }
.item:nth-child(4) .icon { animation-delay: -1.2s; }
.item:nth-child(5) .icon { animation-delay: -1.6s; }
.item:nth-child(6) .icon { animation-delay: -2s; }
@media (prefers-reduced-motion: reduce) { .icon { animation: none; } }
</style>
