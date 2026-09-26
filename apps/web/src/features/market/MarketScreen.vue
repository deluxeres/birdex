<script setup lang="ts">
// Вкладка 4 — Продать: яйца → монеты.
// Сверху склад (сколько яиц и курс), ниже выбор количества, чек "Ты получишь" и кнопка.
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { ECONOMY } from '@/config/economy'
import { sellValue, eggsForPercent, clampSellAmount } from '@/economy/market'
import { formatNumber, formatCompact } from '@/economy/format'
import PrimaryButton from '@/components/PrimaryButton.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import EggIcon from '@/components/EggIcon.vue'
import CoinIcon from '@/components/CoinIcon.vue'
import CoinText from '@/components/CoinText.vue'
import BirdPointsIcon from '@/components/BirdPointsIcon.vue'
import CoinBalance from '@/components/CoinBalance.vue'
import FarmBackdrop from '@/components/FarmBackdrop.vue'
import { playSound } from '@/services/audio'
import { birdPointsForSale, EGGS_PER_BIRD_POINT } from '@/economy/season'
import { t } from '@/i18n'

const game = useGameStore()
const ui = useUiStore()

const total = computed(() => game.balance?.eggs ?? 0)
const capacity = computed(() => game.balance?.storageCapacity ?? 0)
const amount = ref(total.value)
watch(total, (v) => (amount.value = clampSellAmount(amount.value, v)))

const coins = computed(() => sellValue(amount.value))
/** Сколько BIRD Points даст эта продажа (1 за каждые 100 проданных яиц, остаток копится). */
const soldEggs = computed(() => game.state?.stats.soldEggs ?? 0)
const points = computed(() => birdPointsForSale(soldEggs.value, soldEggs.value + amount.value))
/** Сколько яиц ещё продать до следующего очка. */
const toNextPoint = computed(() => EGGS_PER_BIRD_POINT - ((soldEggs.value + amount.value) % EGGS_PER_BIRD_POINT))
const step = computed(() => Math.max(1, Math.round(total.value / 20)))
/** Заполнение ползунка в % — для золотой полосы слева от бегунка. */
const fill = computed(() => (total.value > 0 ? (amount.value / total.value) * 100 : 0))

const PRESETS = [25, 50, 75, 100]
const activePreset = computed(() => PRESETS.find((p) => total.value > 0 && eggsForPercent(total.value, p) === amount.value))

function setPercent(p: number) {
  playSound('click', 0.5)
  amount.value = eggsForPercent(total.value, p)
}
function nudge(dir: 1 | -1) {
  amount.value = clampSellAmount(amount.value + dir * step.value, total.value)
}
function onInput(e: Event) {
  amount.value = clampSellAmount(Number((e.target as HTMLInputElement).value), total.value)
}

// Монета в чеке подпрыгивает при каждом изменении суммы.
const bump = ref(false)
watch(coins, () => {
  bump.value = false
  requestAnimationFrame(() => (bump.value = true))
})

async function sell() {
  const res = await game.sellEggs(amount.value)
  if (res) {
    ui.toast(t('market.sold', { eggs: formatNumber(res.eggsSold), coins: formatNumber(res.coinsReceived) }), 'success')
    if (res.birdPointsAwarded > 0) {
      setTimeout(() => ui.toast(t('market.pointsGot', { n: formatNumber(res.birdPointsAwarded) }), 'success'), 350)
    }
    amount.value = game.balance?.eggs ?? 0
  }
}
</script>

<template>
  <FarmBackdrop />
  <div class="screen market">
    <div class="row">
      <h1 class="screen-title title"><CoinIcon :size="28" /> {{ t('market.title') }}</h1>
      <div class="spacer" />
      <CoinBalance />
    </div>

    <!-- Склад -->
    <div class="card stock">
      <div class="pile" aria-hidden="true">
        <EggIcon :size="44" class="e1" /><EggIcon :size="52" class="e2" /><EggIcon :size="44" class="e3" />
      </div>
      <div class="stock-info">
        <div class="muted small">{{ t('market.storage') }}</div>
        <div class="stock-num">{{ formatNumber(total) }} <span class="muted cap">/ {{ formatCompact(capacity) }}</span></div>
        <ProgressBar :value="total" :max="capacity" />
      </div>
      <div class="rate"><CoinText :text="t('market.rate', { n: ECONOMY.eggSellPrice })" :size="14" /></div>
    </div>

    <!-- Сколько продать -->
    <div class="card pick">
      <div class="muted small center">{{ t('market.amount') }}</div>
      <div class="stepper">
        <button class="round" :disabled="amount <= 0" @click="nudge(-1)">−</button>
        <label class="amount">
          <EggIcon :size="30" />
          <input type="number" inputmode="numeric" :value="amount" :max="total" min="0" @input="onInput" />
        </label>
        <button class="round" :disabled="amount >= total" @click="nudge(1)">+</button>
      </div>

      <input
        class="slider"
        type="range"
        min="0"
        :max="total"
        :value="amount"
        :disabled="total <= 0"
        :style="{ '--fill': fill + '%' }"
        @input="onInput"
      />

      <div class="presets">
        <button
          v-for="p in PRESETS"
          :key="p"
          class="chip"
          :class="{ on: activePreset === p }"
          :disabled="total <= 0"
          @click="setPercent(p)"
        >
          {{ p === 100 ? 'MAX' : p + '%' }}
        </button>
      </div>
    </div>

    <!-- Чек -->
    <div class="card receipt">
      <div class="muted small">{{ t('market.willGet') }}</div>
      <div class="gain" :class="{ bump }" @animationend="bump = false">
        <CoinIcon :size="40" class="gain-coin" />
        <span>{{ formatNumber(coins) }}</span>
      </div>
      <div class="bp">
        <span v-if="points > 0" class="bp-gain">+{{ formatNumber(points) }} <BirdPointsIcon :size="16" /> {{ t('season.pointsShort') }}</span>
        <CoinText v-else class="muted" :text="t('market.pointsNext', { n: formatNumber(toNextPoint) })" :size="15" />
      </div>
      <PrimaryButton variant="gold" :disabled="amount <= 0" :loading="game.pending === 'sell'" @click="sell">
        {{ total > 0 ? t('market.sell') : t('market.empty') }}
      </PrimaryButton>
    </div>
  </div>
</template>

<style scoped>
.market { position: relative; z-index: 1; }
.title { display: inline-flex; align-items: center; gap: 8px; }
.small { font-size: 12px; }
.center { text-align: center; }
.card { background: linear-gradient(180deg, rgba(42, 29, 19, 0.88), rgba(32, 22, 15, 0.92)); backdrop-filter: blur(2px); }

/* Склад */
.stock { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px; }
.pile { position: relative; width: 84px; height: 64px; flex: 0 0 auto; }
.pile > * { position: absolute; bottom: 0; filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.4)); }
.e1 { left: 0; transform: rotate(-14deg); }
.e2 { left: 18px; bottom: 6px; z-index: 1; }
.e3 { right: 0; transform: rotate(12deg); }
.stock-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.stock-num { font-size: 26px; font-weight: 900; line-height: 1.1; font-variant-numeric: tabular-nums; }
.cap { font-size: 14px; }
.rate {
  position: absolute; top: -11px; right: 12px; padding: 3px 10px; border-radius: 99px;
  background: var(--gold); color: #4a2a05; font-size: 12px; font-weight: 900; box-shadow: 0 2px 0 var(--gold-dark);
}

/* Выбор количества */
.pick { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.stepper { display: grid; grid-template-columns: 48px 1fr 48px; align-items: center; gap: 10px; }
.round {
  width: 48px; height: 48px; border-radius: 50%; font-size: 26px; font-weight: 900; line-height: 1;
  background: linear-gradient(180deg, var(--surface-wood-light), var(--surface-wood)); box-shadow: 0 3px 0 #3a2413;
}
.round:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #3a2413; }
.round:disabled { opacity: 0.4; }
.amount {
  display: flex; align-items: center; justify-content: center; gap: 6px; height: 56px; padding: 0 12px;
  border-radius: var(--radius-md); background: rgba(0, 0, 0, 0.45); border: 2px solid var(--surface-wood);
}
.amount input {
  width: 100%; min-width: 0; border: 0; background: transparent; color: var(--text-primary);
  font: inherit; font-size: 26px; font-weight: 900; text-align: center; font-variant-numeric: tabular-nums;
  appearance: textfield; -moz-appearance: textfield;
}
.amount input::-webkit-outer-spin-button, .amount input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.amount input:focus { outline: none; }
.amount:focus-within { border-color: var(--gold); }

/* Ползунок: золотая часть слева от бегунка. */
.slider {
  -webkit-appearance: none; appearance: none; width: 100%; height: 12px; border-radius: 99px; margin: 4px 0;
  background: linear-gradient(90deg, var(--gold) 0 var(--fill), rgba(0, 0, 0, 0.5) var(--fill) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 28px; height: 28px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #fff3c4, var(--gold) 60%, var(--gold-dark));
  border: 3px solid #4a2a05; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
.slider::-moz-range-thumb {
  width: 24px; height: 24px; border-radius: 50%; background: var(--gold); border: 3px solid #4a2a05;
}
.slider:disabled { opacity: 0.4; }

.presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.chip {
  height: 38px; border-radius: var(--radius-sm); font-weight: 900; font-size: 14px;
  background: rgba(0, 0, 0, 0.35); border: 2px solid var(--surface-wood); color: var(--text-secondary);
}
.chip.on { background: linear-gradient(180deg, #ffcf5a, var(--gold)); border-color: var(--gold-dark); color: #4a2a05; }
.chip:disabled { opacity: 0.4; }

/* BIRD Points за продажу */
.bp { font-size: 13px; font-weight: 800; text-align: center; }
.bp-gain { display: inline-flex; align-items: center; gap: 4px; color: #8fd3ff; text-shadow: 0 0 8px rgba(120, 200, 255, 0.5); }

/* Чек */
.receipt {
  padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 8px;
  border-color: var(--gold-dark);
  background:
    radial-gradient(ellipse 70% 60% at 50% 35%, rgba(245, 184, 46, 0.22), transparent 70%),
    linear-gradient(180deg, rgba(42, 29, 19, 0.9), rgba(32, 22, 15, 0.94));
}
.receipt :deep(.btn) { width: 100%; }
.gain {
  display: inline-flex; align-items: center; gap: 8px; font-size: 38px; font-weight: 900; color: var(--gold);
  text-shadow: 0 3px 0 #6a3a16; font-variant-numeric: tabular-nums;
}
.gain-coin { filter: drop-shadow(0 0 10px rgba(245, 184, 46, 0.6)); }
.gain.bump .gain-coin { animation: coin-bump 0.3s ease; }
@keyframes coin-bump { 40% { transform: scale(1.2) rotate(-10deg); } }
@media (prefers-reduced-motion: reduce) { .gain.bump .gain-coin { animation: none; } }
</style>
