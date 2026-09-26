<script setup lang="ts">
// Вкладка 5 — Магазин: две вкладки — курицы за монеты и донатные (Telegram Stars / TON).
import { ref } from 'vue'
import { CHICKENS } from '@/config/chickens'
import { DONATE_CHICKENS } from '@/config/donateChickens'
import ShopItem from './ShopItem.vue'
import DonateItem from './DonateItem.vue'
import CoinBalance from '@/components/CoinBalance.vue'
import CoinIcon from '@/components/CoinIcon.vue'
import FarmBackdrop from '@/components/FarmBackdrop.vue'
import { ASSETS } from '@/config/assets'
import { playSound } from '@/services/audio'
import { t } from '@/i18n'

const forSale = CHICKENS.filter((c) => c.price > 0)
const tab = ref<'coins' | 'donate'>('coins')

function setTab(v: 'coins' | 'donate') {
  if (tab.value === v) return
  playSound('click', 0.5)
  tab.value = v
}
</script>

<template>
  <FarmBackdrop />
  <div class="screen shop">
    <div class="row">
      <h1 class="screen-title title-ico"><img :src="ASSETS.ui.shop" alt="" /> {{ t('shop.title') }}</h1>
      <div class="spacer" />
      <CoinBalance />
    </div>

    <div class="tabs">
      <button :class="{ on: tab === 'coins' }" @click="setTab('coins')"><CoinIcon :size="18" /> {{ t('shop.tabCoins') }}</button>
      <button class="donate" :class="{ on: tab === 'donate' }" @click="setTab('donate')">⭐ {{ t('shop.tabDonate') }}</button>
    </div>

    <template v-if="tab === 'coins'">
      <ShopItem v-for="def in forSale" :key="def.key" :def="def" />
    </template>
    <template v-else>
      <p class="hint">{{ t('shop.donateHint') }}</p>
      <DonateItem v-for="def in DONATE_CHICKENS" :key="def.key" :def="def" />
    </template>
  </div>
</template>

<style scoped>
.shop { position: relative; z-index: 1; }
.title-ico { display: inline-flex; align-items: center; gap: 8px; }
.title-ico img { width: 36px; height: 36px; object-fit: contain; }
.tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: 14px;
  background: rgba(20, 12, 6, 0.75); border: 1px solid rgba(255, 220, 150, 0.16);
}
.tabs button {
  height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 15px; font-weight: 900; color: var(--text-secondary);
}
.tabs button.on { color: #3a2108; background: linear-gradient(180deg, #ffe17a, var(--gold)); box-shadow: 0 2px 0 var(--gold-dark); }
.tabs button.donate.on { color: #fff; background: linear-gradient(180deg, #c98bff, #7b3fe0); box-shadow: 0 2px 0 #4a1f99; }
.hint { margin: 0; text-align: center; font-size: 12px; font-weight: 700; color: var(--cream); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
</style>
