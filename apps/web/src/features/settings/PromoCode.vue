<script setup lang="ts">
// Бонус-код в настройках: ввёл код → монеты. Каждый код — 1 раз.
import { ASSETS } from '@/config/assets'
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { formatNumber } from '@/economy/format'
import { playSound } from '@/services/audio'
import { useShake } from '@/composables/useShake'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { t } from '@/i18n'

const game = useGameStore()
const ui = useUiStore()
const code = ref('')
const { shaking, shake } = useShake()

async function apply() {
  if (!code.value.trim()) {
    playSound('error', 0.7)
    shake()
    return
  }
  const res = await game.redeemCode(code.value)
  if (res) {
    const parts: string[] = []
    if (res.coins) parts.push(`+${formatNumber(res.coins)} 🪙`)
    if (res.energy) parts.push(`+${formatNumber(res.energy)} ⚡ ${t(`modes.${res.energyMode ?? 'catch'}.title`)}`)
    ui.toast(t('settings.promoSuccess', { reward: parts.join(' ') }), 'success')
    code.value = ''
  } else {
    shake() // ошибку (нет кода / уже был) покажет стор
  }
}
</script>

<template>
  <div class="card promo">
    <label class="title" for="promo-code"><img class="gift" :src="ASSETS.ui.present" alt="" /> {{ t('settings.promoTitle') }}</label>
    <form class="row" :class="{ 'shake-x': shaking }" @animationend="shaking = false" @submit.prevent="apply">
      <input
        id="promo-code"
        v-model="code"
        class="input"
        maxlength="32"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :placeholder="t('settings.promoPlaceholder')"
      />
      <PrimaryButton small variant="gold" :loading="game.pending === 'promo'">
        {{ t('settings.promoApply') }}
      </PrimaryButton>
    </form>
  </div>
</template>

<style scoped>
.promo { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.title { font-weight: 900; display: inline-flex; align-items: center; gap: 6px; }
.gift { width: 24px; height: 30px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)); }
.input {
  flex: 1; min-width: 0; height: 40px; padding: 0 12px; border-radius: var(--radius-sm);
  border: 2px solid var(--surface-wood); background: rgba(0, 0, 0, 0.4); color: var(--text-primary);
  font-weight: 800; letter-spacing: 0.04em;
}
.input:focus { outline: none; border-color: var(--gold); }
</style>
