<script setup lang="ts">
import { formatCompact, formatNumber } from '@/economy/format'

const props = defineProps<{ icon?: string; value: number; max?: number; plus?: boolean; compact?: boolean }>()
defineEmits<{ plus: [] }>()

function formatValue(value: number): string {
  return props.compact ? formatCompact(value) : formatNumber(value)
}
</script>

<template>
  <div class="pill">
    <span class="icon"><slot name="icon">{{ icon }}</slot></span>
    <span class="value">
      {{ formatValue(value) }}<span v-if="max !== undefined" class="max"> / {{ formatValue(max) }}</span>
    </span>
    <button v-if="plus" class="plus" @click="$emit('plus')">+</button>
  </div>
</template>

<style scoped>
.pill {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px 4px 4px; border-radius: 999px;
  background: rgba(0, 0, 0, 0.45); border: 2px solid var(--surface-wood);
  min-height: 34px;
}
.icon { font-size: 20px; line-height: 1; display: inline-flex; }
.value { font-weight: 900; font-size: 16px; white-space: nowrap; }
.max { color: var(--text-secondary); font-size: 13px; }
.plus {
  width: 24px; height: 24px; border-radius: 7px; font-weight: 900;
  background: var(--green-success); box-shadow: 0 2px 0 var(--green-dark);
}
</style>
