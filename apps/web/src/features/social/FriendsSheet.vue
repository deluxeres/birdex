<script setup lang="ts">
// Друзья = игроки, пришедшие по твоей ссылке (startapp=ref_<твой Telegram ID>).
// Активный друг — дорос до 2-го уровня. Список приходит с сервера.
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useGameStore } from '@/stores/game'
import { api } from '@/services/api'
import { shareInviteLink } from '@/services/telegram'
import { TELEGRAM_APP_LINK } from '@/config/telegram'
import type { Friend } from '@/types/game'
import BottomSheet from '@/components/BottomSheet.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { t } from '@/i18n'

const ui = useUiStore()
const game = useGameStore()
const friends = ref<Friend[]>([])
const online = ref(true)
const loading = ref(false)
const active = computed(() => friends.value.filter((f) => f.active).length)

const myId = computed(() => game.profile?.id ?? '')
const inviteLink = computed(() => `${TELEGRAM_APP_LINK}?startapp=ref_${myId.value}`)

watch(
  () => ui.sheet,
  async (s) => {
    if (s !== 'friends') return
    loading.value = true
    try {
      const res = await api.friends()
      friends.value = res.friends
      online.value = res.online
    } catch {
      friends.value = []
    }
    loading.value = false
  },
)

function invite() {
  shareInviteLink(inviteLink.value, t('friends.inviteText'))
}

async function copy() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    ui.toast(t('friends.copied'), 'success')
  } catch {
    ui.toast(inviteLink.value)
  }
}
</script>

<template>
  <BottomSheet :open="ui.sheet === 'friends'" :title="t('friends.title')" @close="ui.closeSheet()">
    <div v-if="!online" class="muted center">{{ t('friends.offline') }}</div>
    <template v-else>
      <div class="card stats row">
        <span>🐤 {{ t('friends.count', { n: friends.length }) }}</span>
        <div class="spacer" />
        <span class="muted">{{ t('friends.active', { n: active }) }}</span>
      </div>

      <div class="card code">
        <div class="muted small">{{ t('friends.yourId') }}</div>
        <div class="row">
          <code class="id">{{ myId }}</code>
          <div class="spacer" />
          <button class="copy" @click="copy">📋 {{ t('friends.copyLink') }}</button>
        </div>
      </div>

      <div v-if="loading" class="muted center">…</div>
      <div v-else-if="friends.length === 0" class="muted center">{{ t('friends.empty') }}</div>
      <div v-for="f in friends" :key="f.id" class="card friend row">
        <span class="ava">🧑‍🌾</span>
        <span class="name">{{ f.name }}</span>
        <div class="spacer" />
        <span class="muted small">{{ t('header.level', { n: f.level ?? 1 }) }}</span>
        <span :class="f.active ? 'ok' : 'muted'">{{ f.active ? t('friends.activeLabel') : t('friends.inactiveLabel') }}</span>
      </div>

      <PrimaryButton variant="gold" @click="invite">📨 {{ t('friends.invite') }}</PrimaryButton>
    </template>
  </BottomSheet>
</template>

<style scoped>
.center { text-align: center; padding: 14px; }
.small { font-size: 12px; }
.stats { padding: 12px; font-weight: 900; }
.code { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.id { font-size: 16px; font-weight: 900; color: var(--gold); letter-spacing: 0.04em; }
.copy { padding: 6px 10px; border-radius: var(--radius-sm); background: var(--surface-wood); font-size: 13px; font-weight: 800; }
.friend { padding: 10px 12px; gap: 8px; }
.ava { font-size: 22px; }
.name { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ok { color: var(--green-success); }
</style>
