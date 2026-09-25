<script setup lang="ts">
// Рейтинг ферм: только настоящие игроки (с сервера), сортировка по вложенным в куриц монетам.
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { api } from '@/services/api'
import type { LeaderboardResult } from '@/services/apiTypes'
import { formatCompact, formatNumber } from '@/economy/format'
import BottomSheet from '@/components/BottomSheet.vue'
import { t } from '@/i18n'

const ui = useUiStore()
const data = ref<LeaderboardResult | null>(null)
const loading = ref(false)
const failed = ref(false)

watch(
  () => ui.sheet,
  async (s) => {
    if (s !== 'rating') return
    loading.value = true
    failed.value = false
    try {
      data.value = await api.leaderboard()
    } catch {
      failed.value = true
    }
    loading.value = false
  },
)

const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`)
</script>

<template>
  <BottomSheet :open="ui.sheet === 'rating'" :title="t('rating.title')" @close="ui.closeSheet()">
    <div v-if="loading" class="muted center">…</div>
    <div v-else-if="failed" class="muted center">{{ t('rating.error') }}</div>
    <div v-else-if="data && !data.online" class="muted center">{{ t('rating.offline') }}</div>
    <template v-else-if="data">
      <div class="muted small">{{ t('rating.value') }}</div>
      <div v-if="data.top.length === 0" class="muted center">{{ t('rating.empty') }}</div>
      <div v-for="e in data.top" :key="e.rank" class="card entry row" :class="{ me: e.isMe }">
        <span class="rank">{{ medal(e.rank) }}</span>
        <div class="who">
          <div class="name">{{ e.isMe ? `${e.name} (${t('rating.you')})` : e.name }}</div>
          <div class="muted tiny">{{ t('header.level', { n: e.level ?? 1 }) }}<template v-if="e.farmName"> · {{ e.farmName }}</template></div>
        </div>
        <div class="spacer" />
        <span class="val">🪙 {{ formatCompact(e.farmValue) }}</span>
      </div>
      <div v-if="data.me && !data.top.some((e) => e.isMe)" class="card entry row me">
        <span class="rank">#{{ formatNumber(data.me.rank) }}</span>
        <div class="who"><div class="name">{{ t('rating.you') }}</div></div>
        <div class="spacer" />
        <span class="val">🪙 {{ formatCompact(data.me.farmValue) }}</span>
      </div>
    </template>
  </BottomSheet>
</template>

<style scoped>
.small { font-size: 12px; }
.tiny { font-size: 11px; }
.center { text-align: center; padding: 16px; }
.entry { padding: 10px 12px; gap: 10px; }
.entry.me { border-color: var(--gold); }
.rank { width: 40px; font-weight: 900; }
.who { min-width: 0; }
.name { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.val { font-weight: 900; white-space: nowrap; }
</style>
