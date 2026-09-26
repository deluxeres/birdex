<script setup lang="ts">
// Карточка донатной курицы: цена в Telegram Stars и в TON.
import { useUiStore } from '@/stores/ui'
import type { DonateChicken } from '@/config/donateChickens'
import { formatNumber } from '@/economy/format'
import { playSound } from '@/services/audio'
import EggIcon from '@/components/EggIcon.vue'
import { t } from '@/i18n'

defineProps<{ def: DonateChicken }>()
const ui = useUiStore()

// TODO(оплата): Stars — createInvoiceLink на сервере + Telegram.WebApp.openInvoice; TON — TON Connect.
function buy() {
  playSound('click', 0.6)
  ui.toast(t('shop.paySoon'), 'info')
}
</script>

<template>
  <div class="card item" :style="{ '--c': def.color }">
    <div class="pic">
      <img :src="def.asset" alt="" draggable="false" />
    </div>
    <div class="info">
      <div class="name">{{ def.name }}</div>
      <div class="tag">{{ t('shop.premium') }}</div>
      <div class="small row-i"><EggIcon :size="14" /> {{ t('shop.production', { n: formatNumber(def.eggsPerHour) }) }}</div>
    </div>
    <div class="pay">
      <button class="p stars" @click="buy">⭐ {{ formatNumber(def.stars) }}</button>
      <button class="p ton" @click="buy"><span class="ton-ico">◆</span> {{ def.ton }} TON</button>
    </div>
  </div>
</template>

<style scoped>
.item {
  display: flex; align-items: center; gap: 10px; padding: 10px;
  border-color: var(--c);
  background: linear-gradient(135deg, color-mix(in srgb, var(--c) 22%, #2a1a0d), #1e130a 70%);
  box-shadow: 0 0 12px color-mix(in srgb, var(--c) 35%, transparent);
}
.pic { width: 76px; height: 76px; flex: 0 0 auto; display: grid; place-items: center; }
.pic img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)); }
.info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name { font-weight: 900; font-size: 15px; line-height: 1.15; }
.tag { align-self: flex-start; padding: 1px 8px; border-radius: 99px; font-size: 10px; font-weight: 900; color: #1a1005; background: var(--c); }
.small { font-size: 12px; }
.row-i { display: flex; align-items: center; gap: 4px; }
.pay { display: flex; flex-direction: column; gap: 6px; }
.p {
  min-width: 92px; height: 32px; padding: 0 10px; border-radius: 10px; font-size: 13px; font-weight: 1000; white-space: nowrap;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
}
.p:active { transform: translateY(2px); }
.stars { color: #3a2108; background: linear-gradient(180deg, #ffe17a, var(--gold)); box-shadow: 0 3px 0 var(--gold-dark); }
.ton { color: #fff; background: linear-gradient(180deg, #4fb6ff, #0088cc); box-shadow: 0 3px 0 #005a88; }
.ton-ico { font-size: 11px; }
</style>
