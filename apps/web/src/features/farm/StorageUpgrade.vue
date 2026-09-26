<script setup lang="ts">
import CoinIcon from '@/components/CoinIcon.vue'
// Прокачка склада на ферме: вместимость сейчас → после, цена. Нет монет — error + тряска.
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { storageCapacity, storageUpgradeCost, STORAGE_MAX_LEVEL } from '@/economy/storage'
import { formatCompact } from '@/economy/format'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { useShake } from '@/composables/useShake'
import { t } from '@/i18n'

/** compact — только новая вместимость (для узкой плашки на панели фермы). */
const props = defineProps<{ compact?: boolean }>()
const game = useGameStore()
const ui = useUiStore()
const { shaking, shake } = useShake()

const level = computed(() => game.state?.storageLevel ?? 0)
const maxed = computed(() => level.value >= STORAGE_MAX_LEVEL)
const cost = computed(() => storageUpgradeCost(level.value))
const next = computed(() => storageCapacity(level.value + 1))
const affordable = computed(() => (game.balance?.coins ?? 0) >= cost.value)

function upgrade() {
  if (!affordable.value) {
    playSound('error', 0.7)
    haptics.error()
    ui.toast(t('errors.NOT_ENOUGH_COINS'), 'error')
    shake()
    return
  }
  game.upgradeStorage()
}
</script>

<template>
  <div v-if="maxed" class="maxed muted">{{ t('farm.storageMaxed') }}</div>
  <button
    v-else
    class="up"
    :class="{ poor: !affordable, 'shake-x': shaking }"
    :disabled="game.pending === 'storage'"
    @click="upgrade"
    @animationend="shaking = false"
  >
    <span class="arrow">⬆</span>
    <span v-if="props.compact">{{ formatCompact(next) }}</span>
    <span v-else>{{ formatCompact(game.balance?.storageCapacity ?? 0) }} → {{ formatCompact(next) }}</span>
    <span class="price"><CoinIcon :size="16" /> {{ formatCompact(cost) }}</span>
  </button>
</template>

<style scoped>
.up {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px;
  border-radius: var(--radius-sm); font-size: 12px; font-weight: 900; white-space: nowrap;
  background: linear-gradient(180deg, #5fd04f, var(--green-success)); box-shadow: 0 3px 0 var(--green-dark);
  color: #fff; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35); transition: transform 0.08s;
}
.up:active { transform: translateY(2px); box-shadow: none; }
.up.poor { background: linear-gradient(180deg, var(--surface-wood-light), var(--surface-wood)); box-shadow: 0 3px 0 #3a2414; }
.up:disabled { opacity: 0.7; }
.price { padding-left: 6px; border-left: 1px solid rgba(255, 255, 255, 0.3); }
.arrow { font-size: 11px; }
.maxed { font-size: 12px; }
</style>
