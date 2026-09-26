<script setup lang="ts">
// Вкладка 2 — Play: сначала меню режимов, потом выбранная игра. "В меню" возвращает к выбору.
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { FARM_BACKGROUNDS } from '@/config/assets'
import type { PlayMode } from '@/economy/modes'
import GameBackground from '@/components/GameBackground.vue'
import PlayMenu from './PlayMenu.vue'
import CatchGame from './CatchGame.vue'
import FoxGame from './modes/FoxGame.vue'
import RunGame from './modes/RunGame.vue'
import DoubleGame from './modes/DoubleGame.vue'

const settings = useSettingsStore()
const bgSrc = computed(() => FARM_BACKGROUNDS[settings.farmBg] ?? FARM_BACKGROUNDS[0])
const mode = ref<PlayMode | null>(null)
</script>

<template>
  <!-- В меню фон чистый, в самих играх — затемнён и чуть размыт, чтобы не мешал. -->
  <GameBackground :src="bgSrc" :dim="mode ? 0.5 : 0.3" :blur="mode ? 4 : 0" />
  <PlayMenu v-if="!mode" @select="mode = $event" />
  <CatchGame v-else-if="mode === 'catch'" @back="mode = null" />
  <FoxGame v-else-if="mode === 'fox'" @back="mode = null" />
  <RunGame v-else-if="mode === 'run'" @back="mode = null" />
  <DoubleGame v-else-if="mode === 'double'" @back="mode = null" />
</template>
