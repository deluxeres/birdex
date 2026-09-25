<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import PrimaryButton from '@/components/PrimaryButton.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import EggIcon from '@/components/EggIcon.vue'
import StorageUpgrade from './StorageUpgrade.vue'
import { formatNumber } from '@/economy/format'
import { useUiStore } from '@/stores/ui'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { useShake } from '@/composables/useShake'
import { t } from '@/i18n'

const emit = defineEmits<{ collected: [n: number] }>()
const game = useGameStore()
const ui = useUiStore()
const { shaking, shake } = useShake()

const full = computed(() => {
  const b = game.balance
  return !!b && b.eggs >= b.storageCapacity
})

async function collect() {
  // Нечего собирать — звук ошибки и тряска кнопки (без запроса на сервер).
  if (game.readyToCollect <= 0) {
    playSound('error', 0.7)
    haptics.error()
    ui.toast(t('farm.nothingYet'), 'error')
    shake()
    return
  }
  const n = await game.collect()
  if (n > 0) emit('collected', n)
}
</script>

<template>
  <div class="card offline">
    <div class="row">
      <div>
        <div class="muted small">{{ full ? t('farm.storageFull') : t('farm.produced') }}</div>
        <div class="amount"><EggIcon :size="28" /> {{ formatNumber(game.readyToCollect) }}</div>
      </div>
      <div class="spacer" />
      <div :class="{ 'shake-x': shaking, empty: game.readyToCollect <= 0 }" @animationend="shaking = false">
        <PrimaryButton :loading="game.pending === 'collect'" @click="collect">
          {{ t('farm.collect') }}
        </PrimaryButton>
      </div>
    </div>
    <div class="storage">
      <div class="row">
        <span class="muted small">
          {{ t('farm.storage') }} · {{ formatNumber(game.balance?.eggs ?? 0) }} / {{ formatNumber(game.balance?.storageCapacity ?? 0) }}
        </span>
        <div class="spacer" />
        <StorageUpgrade />
      </div>
      <ProgressBar
        :value="game.balance?.eggs ?? 0"
        :max="game.balance?.storageCapacity ?? 1"
        :color="full ? 'var(--red-accent)' : 'var(--egg-shell)'"
      />
    </div>
  </div>
</template>

<style scoped>
.offline { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.small { font-size: 13px; }
.amount { display: flex; align-items: center; gap: 6px; font-size: 26px; font-weight: 900; }
.empty :deep(.btn) { filter: saturate(0.5) brightness(0.8); }
.storage { display: flex; flex-direction: column; gap: 4px; }
</style>
