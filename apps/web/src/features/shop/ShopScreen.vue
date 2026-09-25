<script setup lang="ts">
// Вкладка 5 — Магазин: покупка новых куриц за монеты.
import { CHICKENS } from '@/config/chickens'
import ShopItem from './ShopItem.vue'
import CoinBalance from '@/components/CoinBalance.vue'
import { t } from '@/i18n'

const forSale = CHICKENS.filter((c) => c.price > 0)
</script>

<template>
  <div class="screen">
    <div class="row">
      <h1 class="screen-title">🏪 {{ t('shop.title') }}</h1>
      <div class="spacer" />
      <CoinBalance />
    </div>
    <ShopItem v-for="def in forSale" :key="def.key" :def="def" />
  </div>
</template>
