<script setup lang="ts">
// Настройки: название фермы, звук и музыка (вкл/выкл + громкость), вибрация.
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { playSound } from '@/services/audio'
import BottomSheet from '@/components/BottomSheet.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import PromoCode from './PromoCode.vue'
import { t } from '@/i18n'

const ui = useUiStore()
const game = useGameStore()
const settings = useSettingsStore()
const name = ref('')

watch(
  () => ui.sheet,
  (s) => {
    if (s === 'settings') name.value = game.profile?.farmName ?? ''
  },
)

// Отпустил ползунок звуков — короткий "клик", чтобы услышать новую громкость.
function previewSound() {
  if (settings.sound) playSound('click', 0.8)
}
</script>

<template>
  <BottomSheet :open="ui.sheet === 'settings'" :title="t('settings.title')" @close="ui.closeSheet()">
    <label class="muted small" for="farm-name">{{ t('settings.farmName') }}</label>
    <div class="row">
      <input id="farm-name" v-model="name" maxlength="24" class="input" />
      <PrimaryButton small :loading="game.pending === 'rename'" @click="game.renameFarm(name)">
        {{ t('settings.save') }}
      </PrimaryButton>
    </div>

    <div class="card opt">
      <label class="row" for="opt-sound">
        <span>🔊 {{ t('settings.sound') }}</span>
        <div class="spacer" />
        <input id="opt-sound" v-model="settings.sound" type="checkbox" />
      </label>
      <div class="vol row" :class="{ off: !settings.sound }">
        <span class="muted small">{{ t('settings.volume') }}</span>
        <input
          id="vol-sound"
          v-model.number="settings.soundVolume"
          class="slider"
          type="range"
          min="0"
          max="100"
          step="5"
          :disabled="!settings.sound"
          :style="{ '--p': settings.soundVolume + '%' }"
          @change="previewSound"
        />
        <span class="pct">{{ settings.soundVolume }}%</span>
      </div>
    </div>

    <div class="card opt">
      <label class="row" for="opt-music">
        <span>🎵 {{ t('settings.music') }}</span>
        <div class="spacer" />
        <input id="opt-music" v-model="settings.music" type="checkbox" />
      </label>
      <div class="vol row" :class="{ off: !settings.music }">
        <span class="muted small">{{ t('settings.volume') }}</span>
        <input
          id="vol-music"
          v-model.number="settings.musicVolume"
          class="slider"
          type="range"
          min="0"
          max="100"
          step="5"
          :disabled="!settings.music"
          :style="{ '--p': settings.musicVolume + '%' }"
        />
        <span class="pct">{{ settings.musicVolume }}%</span>
      </div>
    </div>

    <label class="card opt-row row" for="opt-haptics">
      <span>📳 {{ t('settings.haptics') }}</span>
      <div class="spacer" />
      <input id="opt-haptics" v-model="settings.haptics" type="checkbox" />
    </label>

    <PromoCode />
  </BottomSheet>
</template>

<style scoped>
.small { font-size: 12px; }
.input {
  flex: 1; height: 40px; padding: 0 12px; border-radius: var(--radius-sm);
  border: 2px solid var(--surface-wood); background: rgba(0, 0, 0, 0.4); color: var(--text-primary);
}
.opt { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.opt-row { padding: 12px; }
input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--green-success); }
.vol { gap: 10px; transition: opacity 0.2s; }
.vol.off { opacity: 0.4; }
.pct { width: 40px; text-align: right; font-size: 13px; font-weight: 900; color: var(--gold); font-variant-numeric: tabular-nums; }

/* Ползунок громкости в стиле игры: золотая заливка по дереву. */
.slider {
  flex: 1; height: 22px; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; cursor: pointer;
}
.slider::-webkit-slider-runnable-track {
  height: 8px; border-radius: 99px;
  background: linear-gradient(90deg, var(--gold) var(--p), rgba(0, 0, 0, 0.5) var(--p));
}
.slider::-moz-range-track { height: 8px; border-radius: 99px; background: rgba(0, 0, 0, 0.5); }
.slider::-moz-range-progress { height: 8px; border-radius: 99px; background: var(--gold); }
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 22px; height: 22px; margin-top: -7px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffe7a0, var(--gold) 55%, var(--gold-dark));
  border: 2px solid #5a3a14; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}
.slider::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffe7a0, var(--gold) 55%, var(--gold-dark));
  border: 2px solid #5a3a14;
}
.slider:disabled { cursor: default; }
.slider:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; border-radius: 99px; }
</style>
