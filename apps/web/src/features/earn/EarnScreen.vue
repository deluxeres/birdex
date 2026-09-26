<script setup lang="ts">
import { ASSETS } from '@/config/assets'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import FarmBackdrop from '@/components/FarmBackdrop.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import EggIcon from '@/components/EggIcon.vue'
import BirdPointsIcon from '@/components/BirdPointsIcon.vue'
import DailyRewardTile from '@/components/DailyRewardTile.vue'
import PromoCode from '@/features/settings/PromoCode.vue'
import { TELEGRAM_CHANNEL_LINK } from '@/config/telegram'
import { openTgLink } from '@/services/telegram'
import { api } from '@/services/api'
import { formatNumber } from '@/economy/format'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import ChannelBonusPopup from './ChannelBonusPopup.vue'
import { t } from '@/i18n'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'

const game = useGameStore()
const ui = useUiStore()

const channelWaiting = ref(false)
const subscribed = computed(() => !!game.state?.events.channelSubscribed)
const claimed = computed(() => !!game.state?.events.channelBonusClaimed)
const friendCount = ref(0)
const friendsOnline = ref(false)
const invite5Claimed = computed(() => !!game.state?.events.invite5Claimed)
const invite10Claimed = computed(() => !!game.state?.events.invite10Claimed)
const invite25Claimed = computed(() => !!game.state?.events.invite25Claimed)
const invite100Claimed = computed(() => !!game.state?.events.invite100Claimed)
const channelButtonText = computed(() => {
  if (claimed.value) return t('earn.alreadyClaimed')
  if (subscribed.value) return t('earn.claimBonus')
  if (channelWaiting.value) return t('earn.check')
  return t('earn.subscribe')
})
const channelPending = computed(() => game.pending === 'channel-check' || game.pending === 'channel-bonus')

const inviteTasks = computed(() => [
  { target: 5 as const, reward: 20000, birdPoints: 0, claimed: invite5Claimed.value },
  { target: 10 as const, reward: 50000, birdPoints: 0, claimed: invite10Claimed.value },
  { target: 25 as const, reward: 150000, birdPoints: 250, claimed: invite25Claimed.value },
  { target: 100 as const, reward: 800000, birdPoints: 2000, claimed: invite100Claimed.value },
])

// Нажал "Подписаться" → ушёл в канал → вернулся в игру: сами проверяем подписку
// и показываем окно с наградой. Флаг в sessionStorage — на случай, если Telegram перезагрузит игру.
const WAIT_KEY = 'birdex_channel_wait'
const popup = ref(false)

function setWaiting(v: boolean) {
  channelWaiting.value = v
  try {
    if (v) sessionStorage.setItem(WAIT_KEY, '1')
    else sessionStorage.removeItem(WAIT_KEY)
  } catch {
    /* хранилище недоступно — просто без флага */
  }
}
function isWaiting(): boolean {
  try {
    return sessionStorage.getItem(WAIT_KEY) === '1'
  } catch {
    return false
  }
}

function subscribe() {
  if (!claimed.value) setWaiting(true)
  openTgLink(TELEGRAM_CHANNEL_LINK)
}

async function channelAction() {
  if (claimed.value) return
  if (!subscribed.value && !channelWaiting.value) {
    subscribe()
    return
  }
  if (!subscribed.value) {
    await check()
    return
  }
  await claim()
}

async function loadFriendsProgress() {
  try {
    const res = await api.friends()
    friendCount.value = res.friends.length
    friendsOnline.value = res.online
  } catch {
    friendCount.value = 0
    friendsOnline.value = false
  }
}

async function autoCheck() {
  if (document.visibilityState !== 'visible' || !isWaiting() || claimed.value) return
  setWaiting(false)
  const ok = await game.verifyChannelSubscription()
  if (ok && !claimed.value) popup.value = true
}

async function claimFromPopup() {
  await claim()
  popup.value = false
}

onMounted(() => {
  channelWaiting.value = isWaiting()
  document.addEventListener('visibilitychange', autoCheck)
  window.addEventListener('focus', autoCheck)
  autoCheck()
  loadFriendsProgress()
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', autoCheck)
  window.removeEventListener('focus', autoCheck)
})

async function check() {
  const ok = await game.verifyChannelSubscription()
  if (ok) ui.toast(t('earn.subscribed'), 'success')
}

async function claim() {
  const coins = await game.claimChannelBonus()
  if (coins > 0) ui.toast(t('earn.claimed', { n: formatNumber(coins) }), 'success')
}

/** Задание, у которого трясётся кнопка (ещё не выполнено). */
const shakeTask = ref<number | null>(null)

async function claimInvite(target: 5 | 10 | 25 | 100) {
  // Не выполнено — ошибка, звук и тряска кнопки (без запроса на сервер).
  if (friendCount.value < target || !friendsOnline.value) {
    playSound('error', 0.7)
    haptics.error()
    ui.toast(t('earn.inviteNotReady', { n: formatNumber(Math.max(1, target - friendCount.value)) }), 'error')
    shakeTask.value = null
    requestAnimationFrame(() => (shakeTask.value = target))
    return
  }
  const coins = await game.claimInviteTask(target)
  if (coins > 0) {
    const task = inviteTasks.value.find((x) => x.target === target)
    const points = task?.birdPoints ?? 0
    ui.toast(points > 0
      ? t('earn.inviteClaimedPoints', { coins: formatNumber(coins), points: formatNumber(points) })
      : t('earn.inviteClaimed', { n: formatNumber(coins) }), 'success')
    await loadFriendsProgress()
  }
}
</script>

<template>
  <FarmBackdrop />
  <div class="screen earn">
    <h1 class="screen-title bp-title"><BirdPointsIcon :size="30" /> {{ t('earn.title') }}</h1>

    <div class="list">
      <div class="card task-row reward-row">
        <DailyRewardTile @open="ui.openSheet('reward')" />
        <div class="copy">
          <h2>{{ t('reward.title') }}</h2>
          <p class="muted">{{ t('earn.dailyText') }}</p>
        </div>
      </div>

      <div class="card task-row">
        <div class="task-icon"><EggIcon :size="34" golden /></div>
        <div class="copy">
          <h2>{{ t('earn.channelTitle') }}</h2>
          <p class="muted">{{ t('earn.channelText') }}</p>
        </div>
        <div class="actions">
          <PrimaryButton small :variant="subscribed && !claimed ? 'green' : 'gold'" :disabled="claimed" :loading="channelPending" @click="channelAction">
            {{ channelButtonText }}
          </PrimaryButton>
        </div>
      </div>

      <div v-for="task in inviteTasks" :key="task.target" class="card task-row">
        <div class="task-icon invite-icon"><img :src="ASSETS.ui.referral" alt="" draggable="false" /></div>
        <div class="copy">
          <h2>{{ t('earn.inviteTitle', { n: task.target }) }}</h2>
          <p class="muted">
            {{ task.birdPoints > 0
              ? t('earn.inviteTextPoints', { coins: formatNumber(task.reward), points: formatNumber(task.birdPoints) })
              : t('earn.inviteText', { coins: formatNumber(task.reward) }) }}
          </p>
          <div class="progress"><i :style="{ width: Math.min(100, (friendCount / task.target) * 100) + '%' }" /></div>
          <small>{{ formatNumber(Math.min(friendCount, task.target)) }} / {{ task.target }}</small>
        </div>
        <div class="actions" :class="{ 'shake-x': shakeTask === task.target, locked: !task.claimed && friendCount < task.target }" @animationend="shakeTask = null">
          <PrimaryButton
            small
            :disabled="task.claimed"
            :loading="game.pending === `invite:${task.target}`"
            @click="claimInvite(task.target)"
          >
            {{ task.claimed ? t('earn.alreadyClaimed') : t('earn.claimCoins', { n: formatNumber(task.reward) }) }}
          </PrimaryButton>
        </div>
      </div>
    </div>

    <ChannelBonusPopup
      v-if="popup"
      :coins="1000"
      :loading="game.pending === 'channel-bonus'"
      @claim="claimFromPopup"
      @close="popup = false"
    />

    <div class="promo-dock">
      <PromoCode />
    </div>
  </div>
</template>

<style scoped>
.actions.locked :deep(.btn) { filter: saturate(0.35) brightness(0.8); }
.bp-title { display: inline-flex; align-items: center; gap: 8px; }
.earn { position: relative; z-index: 1; padding-bottom: 112px; }
.list { display: flex; flex-direction: column; gap: 8px; }
.task-row { min-height: 74px; padding: 8px; display: grid; grid-template-columns: 44px minmax(0, 1fr) 82px; gap: 8px; align-items: center; }
/* Слева — плашка календаря как в шапке фермы. */
.reward-row { grid-template-columns: 124px minmax(0, 1fr); --tile-ratio: 600 / 225; }
.task-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: rgba(0, 0, 0, 0.35); box-shadow: 0 0 12px rgba(245, 184, 46, 0.35); }
.invite-icon { width: 44px; height: 44px; background: none; box-shadow: none; }
.invite-icon img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)); }
.copy { min-width: 0; }
h2 { margin: 0 0 4px; font-size: 14px; line-height: 1.1; }
p { margin: 0; font-size: 11px; line-height: 1.2; }
.copy small { display: block; margin-top: 2px; color: var(--gold); font-size: 10px; font-weight: 900; }
.progress { height: 5px; margin-top: 5px; border-radius: 999px; background: rgba(0, 0, 0, 0.45); overflow: hidden; }
.progress i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #6be35c, var(--gold)); }
.actions { display: grid; gap: 6px; }
.actions :deep(.btn) { height: 30px; padding: 0 6px; font-size: 11px; border-radius: 7px; }
.promo-dock {
  position: fixed; left: 12px; right: 12px; bottom: calc(72px + var(--safe-bottom)); z-index: 12;
  max-width: calc(var(--app-width) - 24px); margin: 0 auto;
}
.promo-dock :deep(.promo) { margin: 0; box-shadow: var(--shadow-card); }
</style>
