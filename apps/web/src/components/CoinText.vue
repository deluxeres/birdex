<script setup lang="ts">
// Текст, в котором 🪙 заменяется картинкой монеты, а 💎 — картинкой BIRD Points (тосты, подписи из i18n).
import { computed } from 'vue'
import CoinIcon from './CoinIcon.vue'
import BirdPointsIcon from './BirdPointsIcon.vue'

const props = withDefaults(defineProps<{ text: string; size?: number }>(), { size: 16 })
const parts = computed(() => props.text.split(/(🪙|💎)/u).filter((p) => p !== ''))
</script>

<template>
  <span><template v-for="(p, i) in parts" :key="i"><CoinIcon v-if="p === '🪙'" :size="size" /><BirdPointsIcon v-else-if="p === '💎'" :size="size" /><template v-else>{{ p }}</template></template></span>
</template>
