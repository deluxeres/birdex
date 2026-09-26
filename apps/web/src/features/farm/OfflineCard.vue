<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import EggIcon from '@/components/EggIcon.vue'
import StorageUpgrade from './StorageUpgrade.vue'
import CoinIcon from '@/components/CoinIcon.vue'
import { ASSETS } from '@/config/assets'
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

const fillPct = computed(() => {
  const b = game.balance
  return b && b.storageCapacity > 0 ? Math.min(100, (b.eggs / b.storageCapacity) * 100) : 0
})

function goSell() {
  playSound('sellUi', 0.7)
  ui.setTab('market')
}
function goPlay() {
  playSound('click', 0.6)
  ui.setTab('play')
}

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
  const res = await game.collect()
  if (res && res.collected > 0) {
    emit('collected', res.collected)
  }
}
</script>

<template>
  <!-- Панель фермы на картинке ui/farmui: всё лежит поверх нарисованных плашек (позиции в % от картинки). -->
  <div class="farm-ui">
    <img class="bg" :src="ASSETS.ui.farmPanel" alt="" draggable="false" />

    <div class="produced">
      <div class="label">{{ full ? t('farm.storageFull') : t('farm.produced') }}</div>
      <div class="amount"><EggIcon :size="22" /> {{ formatNumber(game.readyToCollect) }}</div>
    </div>

    <button
      class="collect"
      :class="{ 'shake-x': shaking, empty: game.readyToCollect <= 0 }"
      :disabled="game.pending === 'collect'"
      @click="collect"
      @animationend="shaking = false"
    >
      {{ t('farm.collect') }}
    </button>

    <div class="storage-txt">
      {{ t('farm.storage') }} · {{ formatNumber(game.balance?.eggs ?? 0) }} / {{ formatNumber(game.balance?.storageCapacity ?? 0) }}
    </div>
    <div class="storage-up"><StorageUpgrade compact /></div>

    <div class="track"><div class="fill" :class="{ full }" :style="{ width: fillPct + '%' }" /></div>

    <button class="act sell" @click="goSell"><CoinIcon :size="20" /> {{ t('farm.goSell') }}</button>
    <button class="act play" @click="goPlay"><EggIcon :size="19" /> {{ t('farm.goPlay') }}</button>
  </div>
</template>

<style scoped>
.farm-ui {
  position: relative; width: 100%; aspect-ratio: 1875 / 566; /* на 20% ниже картинки — плашки сжаты по высоте */ container-type: inline-size;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45));
}
.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; user-select: none; }

.produced { position: absolute; left: 5.5%; top: 6.5%; width: 58%; }
.label { font-size: 3.2cqw; line-height: 1.15; font-weight: 800; color: #e8c79a; }
.amount { display: flex; align-items: center; gap: 1.5cqw; font-size: 6cqw; font-weight: 900; line-height: 1.1; color: var(--warm-white); }

.collect {
  position: absolute; left: 77.2%; top: 7.9%; width: 19.9%; height: 24.6%; border-radius: 3cqw;
  font-size: 4cqw; font-weight: 1000; color: #fff; text-shadow: 0 0.4cqw 0 #1c5212, 0 0 1cqw rgba(0, 0, 0, 0.3);
  background: transparent;
}
.collect:active:not(:disabled) { transform: translateY(0.4cqw); }
.collect.empty { background: rgba(20, 10, 4, 0.35); color: rgba(255, 255, 255, 0.75); }

.storage-txt {
  position: absolute; left: 5.5%; top: 39.2%; height: 16%; display: flex; align-items: center;
  font-size: 3.2cqw; font-weight: 800; color: #e8c79a; white-space: nowrap;
}
.storage-up { position: absolute; left: 67.8%; top: 39.2%; width: 29.3%; height: 16%; display: flex; }
.storage-up :deep(.up) {
  width: 100%; height: 100%; justify-content: center; gap: 1.2cqw; padding: 0 1cqw; border-radius: 3cqw;
  font-size: 2.9cqw; background: transparent; box-shadow: none; color: #fff4d8;
}
.storage-up :deep(.up .arrow) { color: #7dff5a; font-size: 2.8cqw; }
.storage-up :deep(.up.poor) { background: transparent; color: rgba(255, 244, 216, 0.7); }
.storage-up :deep(.up.poor .arrow) { color: #c9a57a; }
.storage-up :deep(.maxed) { width: 100%; align-self: center; text-align: center; font-size: 3.1cqw; }

.track { position: absolute; left: 3.9%; top: 59.2%; width: 92.4%; height: 4.2%; border-radius: 99px; overflow: hidden; }
.fill { height: 100%; border-radius: 99px; background: linear-gradient(180deg, #fff3d9, var(--egg-shell)); transition: width 0.4s ease; }
.fill.full { background: var(--red-accent); }

.act {
  position: absolute; top: 74.1%; height: 25.2%; display: flex; align-items: center; justify-content: center; gap: 1.6cqw;
  border-radius: 3cqw; font-size: 3.9cqw; font-weight: 900; color: var(--warm-white); background: transparent;
}
.act:active { transform: translateY(0.4cqw); }
.act.sell { left: 0.2%; width: 49.4%; }
.act.play { left: 50.7%; width: 49%; }
</style>
