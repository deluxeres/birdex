<script setup lang="ts">
// Маленький баланс монет для экранов без шапки (Магазин, Курочки).
import { useGameStore } from '@/stores/game'
import { formatCompact } from '@/economy/format'

const game = useGameStore()
</script>

<template>
  <span class="coins">🪙 {{ formatCompact(game.balance?.coins ?? 0) }}</span>
</template>

<style scoped>
.coins {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 99px;
  background: rgba(0, 0, 0, 0.45); border: 2px solid var(--surface-wood);
  font-size: 14px; font-weight: 900; white-space: nowrap; font-variant-numeric: tabular-nums;
}
</style>
