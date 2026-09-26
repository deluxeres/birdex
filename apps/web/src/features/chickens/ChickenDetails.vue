<script setup lang="ts">
import CoinIcon from '@/components/CoinIcon.vue'
// Верхняя панель вкладки "Курочки": выбранная курица, доход, улучшение.
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { getChickenDef } from '@/config/chickens'
import { ASSETS } from '@/config/assets'
import { chickenProduction } from '@/economy/production'
import { upgradeCost, isMaxLevel } from '@/economy/upgrade'
import { formatNumber } from '@/economy/format'
import ChickenAvatar from '@/components/ChickenAvatar.vue'
import EggIcon from '@/components/EggIcon.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { t } from '@/i18n'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { useShake } from '@/composables/useShake'

const props = defineProps<{ chickenKey: string }>()
const game = useGameStore()
const ui = useUiStore()

const def = computed(() => getChickenDef(props.chickenKey))
const owned = computed(() => game.chickens.find((c) => c.key === props.chickenKey) ?? null)
const level = computed(() => owned.value?.level ?? 1)
const prod = computed(() => chickenProduction(props.chickenKey, level.value))
const nextProd = computed(() => chickenProduction(props.chickenKey, level.value + 1))
const cost = computed(() => upgradeCost(props.chickenKey, level.value))
const maxed = computed(() => isMaxLevel(props.chickenKey, level.value))
const affordable = computed(() => (game.balance?.coins ?? 0) >= cost.value)
const { shaking, shake } = useShake()

/** Не хватает монет — ошибка и тряска кнопки, иначе улучшаем. */
function upgrade() {
  if (!owned.value || game.pending) return
  if (!affordable.value) {
    playSound('error', 0.7)
    haptics.error()
    ui.toast(t('errors.NOT_ENOUGH_COINS'), 'error')
    shake()
    return
  }
  game.upgradeChicken(owned.value.id)
}

const isDisplayed = computed(() => owned.value && owned.value.id === game.displayedChicken?.id)
</script>

<template>
  <div class="card details">
    <div class="pic">
      <!-- Обёртка нужна: у самой курицы своя бесконечная анимация дыхания,
           она мешала Vue понять, когда закончилась смена (картинка пропадала). -->
      <Transition name="pop" mode="out-in">
        <div :key="chickenKey" class="pic-inner">
          <ChickenAvatar :chicken-key="chickenKey" :size="130" :locked="!owned" />
        </div>
      </Transition>
    </div>
    <div class="info">
      <div class="title">{{ def.name }}</div>
      <div class="muted small">{{ t(`rarity.${def.rarity}`) }} · {{ t('chickens.levelOf', { n: level, max: def.maxLevel }) }}</div>

      <div class="muted small">{{ t('chickens.income') }}</div>
      <div class="row val">
        <EggIcon :size="20" /> {{ formatNumber(prod) }} / ч
        <span v-if="owned && !maxed" class="plus">+{{ formatNumber(nextProd - prod) }}</span>
      </div>

      <template v-if="owned">
        <template v-if="!maxed">
          <div class="muted small">{{ t('chickens.upgradeCost') }}</div>
          <div class="val"><CoinIcon :size="18" /> {{ formatNumber(cost) }}</div>
          <button
            class="upg"
            :class="{ poor: !affordable, busy: game.pending === `upgrade:${owned.id}`, 'shake-x': shaking }"
            :style="{ backgroundImage: `url(${ASSETS.ui.upgradeBtn})` }"
            @click="upgrade"
            @animationend="shaking = false"
          >
            <img :src="ASSETS.ui.upgradeArrow" alt="" draggable="false" />
            <span>{{ t('chickens.upgrade') }}</span>
          </button>
        </template>
        <div v-else class="val">{{ t('chickens.maxLevel') }}</div>
        <button v-if="!isDisplayed" class="link" @click="game.displayChicken(owned.id)">
          <img class="mini-ico" :src="ASSETS.ui.farm" alt="" /> {{ t('chickens.display') }}
        </button>
        <div v-else class="muted small">✔ {{ t('chickens.displayed') }}</div>
      </template>
      <PrimaryButton v-else small variant="gold" @click="ui.setTab('shop')">
        <img class="mini-ico" :src="ASSETS.ui.shop" alt="" /> {{ t('chickens.toShop') }}
      </PrimaryButton>
    </div>
  </div>
</template>

<style scoped>
/* Кнопка "Улучшить" — картинка ui/upgrade (пропорции 720×104). */
.upg {
  width: 100%; aspect-ratio: 720 / 104; min-height: 34px; margin: 2px 0;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  background: center / 100% 100% no-repeat; border-radius: 12px;
  font-size: 15px; font-weight: 1000; color: #fff; text-shadow: 0 2px 0 #1d6a12, 0 0 4px rgba(0, 0, 0, 0.25);
  transition: transform 0.08s, filter 0.15s;
}
.upg img { height: 58%; width: auto; filter: drop-shadow(0 2px 0 rgba(20, 80, 10, 0.8)); }
.upg:active { transform: translateY(2px); }
.upg.poor { filter: saturate(0.35) brightness(0.8); }
.upg.busy { opacity: 0.7; pointer-events: none; }
.mini-ico { width: 20px; height: 20px; object-fit: contain; vertical-align: -4px; }
.details { display: flex; gap: 10px; padding: 12px; }
.pic { flex: 0 0 130px; display: flex; align-items: flex-end; justify-content: center; }
.info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.title { font-size: 20px; font-weight: 900; }
/* Переключение курицы в деталях — мягкий "поп". */
.pic-inner { display: flex; align-items: flex-end; justify-content: center; }
.pop-leave-active { transition: transform 0.12s ease-in, opacity 0.12s; }
.pop-leave-to { transform: scale(0.7); opacity: 0; }
.pop-enter-active { animation: pop 0.4s cubic-bezier(0.25, 1.6, 0.5, 1) both; }
@keyframes pop {
  0% { transform: scale(0.5) translateY(12px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.small { font-size: 12px; }
.val { font-size: 18px; font-weight: 900; }
.plus { color: var(--green-success); font-size: 14px; }
.link { text-align: left; color: var(--gold); font-size: 13px; margin-top: 4px; }
</style>
