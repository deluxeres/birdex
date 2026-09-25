<script setup lang="ts">
// Вкладка 2 — Play: бесконечная ловля яиц, 3 жизни, скорость растёт.
// Ледяное яйцо — заморозка: все яйца падают в 3 раза медленнее.
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { usePlaySession } from './usePlaySession'
import { ECONOMY } from '@/config/economy'
import { FARM_BACKGROUNDS } from '@/config/assets'
import ChickenAvatar from '@/components/ChickenAvatar.vue'
import EggIcon from '@/components/EggIcon.vue'
import GameBackground from '@/components/GameBackground.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import FloatingReward from '@/components/FloatingReward.vue'
import EnergyPanel from './EnergyPanel.vue'
import SnowFall from '@/components/effects/SnowFall.vue'
import { formatNumber, formatCompact } from '@/economy/format'
import { useUiStore } from '@/stores/ui'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { useShake } from '@/composables/useShake'
import { t } from '@/i18n'

const game = useGameStore()
const settings = useSettingsStore()
const bgSrc = computed(() => FARM_BACKGROUNDS[settings.farmBg] ?? FARM_BACKGROUNDS[0])
const s = usePlaySession()
const field = ref<HTMLElement | null>(null)
const floats = ref<{ id: number; text: string; x: number; y: number; gold: boolean; egg: boolean }[]>([])
let fid = 0

const running = computed(() => s.phase.value === 'running')
const canStart = computed(() => game.energy >= ECONOMY.energy.playCost)
const ui = useUiStore()
const { shaking: startShaking, shake: shakeStart } = useShake()

/** Играть: нет энергии — звук ошибки, тряска кнопки и подсказка. */
function onStart() {
  if (!canStart.value) {
    playSound('error', 0.7)
    haptics.error()
    ui.toast(t('errors.NO_ENERGY'), 'error')
    shakeStart()
    return
  }
  s.start()
}

function onTap(id: number, golden: boolean, ev: PointerEvent) {
  const reward = s.catchEgg(id)
  if (!reward || !field.value) return
  const rect = field.value.getBoundingClientRect()
  const ice = reward < 0
  floats.value.push({
    id: fid++, text: ice ? '❄ ×' + ECONOMY.play.iceSlowFactor : `+${formatCompact(reward)}`, gold: golden, egg: !ice,
    x: ev.clientX - rect.left, y: ev.clientY - rect.top,
  })
}

// Заморозка: меняем скорость уже летящих CSS-анимаций (падение + вращение) через playbackRate.
function applyRate(el: Element | null) {
  el?.getAnimations?.({ subtree: true }).forEach((a) => (a.playbackRate = s.timeScale.value))
}
function eggRef(el: unknown) {
  if (el instanceof Element) applyRate(el)
}
watch(s.timeScale, () => field.value?.querySelectorAll('.egg').forEach(applyRate))

// Тряска экрана при пропущенном яйце.
const shaking = ref(false)
watch(s.lives, (now, before) => {
  if (now >= before || !running.value) return
  shaking.value = false
  requestAnimationFrame(() => (shaking.value = true))
})
</script>

<template>
  <GameBackground :src="bgSrc" :dim="0.3" />
  <div class="screen play">
    <div class="card stats row">
      <span class="eggs"><EggIcon :size="22" /> {{ running ? formatNumber(s.score.value) : formatNumber(game.balance?.eggs ?? 0) }}</span>
      <div class="spacer" />
      <span v-if="running" class="lives" :class="{ hurt: s.hurt.value }" @animationend="s.hurt.value = false">
        <span v-for="i in ECONOMY.play.lives" :key="i" class="life" :class="{ lost: i > s.lives.value }">❤️</span>
      </span>
      <span v-else class="muted">⚡ {{ formatNumber(game.energy) }}</span>
    </div>

    <div ref="field" class="field" :class="{ shake: shaking }" @animationend.self="shaking = false">
      <Transition name="snow"><SnowFall v-if="running && s.frozenLeft.value > 0" /></Transition>
      <div
        v-for="egg in s.eggs.value"
        :key="egg.id"
        :ref="eggRef"
        class="egg"
        :class="[egg.kind, { caught: egg.caught }]"
        :style="{
          left: egg.x + '%',
          '--drift': egg.drift + 'px',
          '--spin': egg.spin + 'deg',
          animationDuration: egg.duration + 'ms',
        }"
        @pointerdown.prevent="onTap(egg.id, egg.kind === 'golden', $event)"
        @animationend.self="s.eggLanded(egg.id)"
      >
        <span class="trail" />
        <span class="body"><EggIcon :size="52" :golden="egg.kind === 'golden'" :ice="egg.kind === 'ice'" /></span>
      </div>

      <FloatingReward v-for="f in floats" :key="f.id" v-bind="f" @done="floats = floats.filter((x) => x.id !== f.id)" />

      <div v-if="running && s.frozenLeft.value > 0" class="freeze-badge">❄ {{ s.frozenLeft.value }}</div>
      <div v-if="running && s.combo.value > 1" class="combo">{{ t('play.combo', { n: s.combo.value }) }}</div>

      <div class="chicken">
        <ChickenAvatar :chicken-key="game.displayedChicken?.key ?? 'farm_hen'" :size="150" />
      </div>

      <div v-if="!running" class="overlay">
        <template v-if="s.phase.value === 'result'">
          <div class="big">{{ t('play.earned', { n: formatNumber(s.lastResult.value) }) }}</div>
          <div class="muted">{{ t('play.caught') }}: {{ s.caught.value }}</div>
        </template>
        <template v-else-if="s.phase.value === 'finishing' || s.phase.value === 'starting'">
          <div class="big">…</div>
        </template>
        <template v-else>
          <div class="big">{{ t('play.title') }}</div>
          <div class="muted hint">{{ t('play.hint', { lives: ECONOMY.play.lives }) }}</div>
          <div class="value">
            {{ t('play.eggValue', { n: formatNumber(s.eggValue.value), level: game.profile?.level ?? 1 }) }}
          </div>
        </template>

        <div
          v-if="s.phase.value === 'idle' || s.phase.value === 'result'"
          :class="{ 'shake-x': startShaking, 'no-energy': !canStart }"
          @animationend="startShaking = false"
        >
          <PrimaryButton variant="gold" @click="onStart">
            ▶ {{ s.phase.value === 'result' ? t('play.again') : t('play.start') }} · ⚡{{ ECONOMY.energy.playCost }}
          </PrimaryButton>
        </div>
        <EnergyPanel v-if="s.phase.value === 'idle' || s.phase.value === 'result'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.play { position: relative; z-index: 1; flex: 1; min-height: 480px; }
.stats { padding: 10px 12px; font-weight: 900; gap: 12px; }
.eggs { display: inline-flex; align-items: center; gap: 4px; }
.lives { display: inline-flex; gap: 2px; font-size: 20px; }
.life { transition: transform 0.2s, filter 0.2s, opacity 0.2s; }
.life.lost { filter: grayscale(1); opacity: 0.35; transform: scale(0.8); }
.lives.hurt { animation: hurt 0.35s ease; }
@keyframes hurt {
  25% { transform: translateX(-4px) scale(1.15); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
}
.field { position: relative; flex: 1; min-height: 360px; overflow: hidden; touch-action: none; border-radius: var(--radius-lg); }
.egg {
  position: absolute; top: -70px; line-height: 0; transform: translateX(-50%); cursor: pointer; padding: 8px;
  animation-name: fall; animation-timing-function: linear; animation-fill-mode: forwards;
}
/* Корпус яйца вращается отдельно, чтобы шлейф над ним не крутился. */
.egg .body {
  display: block; filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.35));
  animation-name: spin; animation-timing-function: linear; animation-fill-mode: forwards;
  animation-duration: inherit;
}
.egg.golden .body { filter: drop-shadow(0 0 10px var(--gold)); }
.egg.ice .body { filter: drop-shadow(0 0 12px rgba(120, 210, 255, 0.95)); }
.egg.ice::after {
  content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  box-shadow: 0 0 0 2px rgba(180, 235, 255, 0.7); animation: ice-ring 1s ease-out infinite;
}
@keyframes ice-ring { from { transform: scale(0.6); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
.egg.caught { animation-play-state: paused; opacity: 0; transform: translateX(-50%) scale(1.6); transition: all 0.2s; }
.egg.caught .body, .egg.caught .trail { animation-play-state: paused; }
@keyframes fall {
  from { transform: translate(-50%, 0); }
  to { transform: translate(calc(-50% + var(--drift)), 115vh); }
}
@keyframes spin { to { transform: rotate(var(--spin)); } }

/* Шлейф ветра над падающим яйцом: мягкий, ненавязчивый; у золотого и ледяного — свой. */
.trail {
  position: absolute; left: 50%; bottom: 62%; width: 34px; height: 96px; transform: translateX(-50%);
  pointer-events: none;
  background:
    radial-gradient(ellipse 45% 100% at 50% 100%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 100%),
    linear-gradient(to top, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 80%) 5px 40% / 2px 55% no-repeat,
    linear-gradient(to top, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0) 80%) calc(100% - 5px) 25% / 2px 70% no-repeat;
  filter: blur(1.2px);
  animation: trail-flicker 0.5s ease-in-out infinite alternate;
}
.egg.golden .trail {
  width: 38px; height: 110px;
  background:
    radial-gradient(ellipse 45% 100% at 50% 100%, rgba(255, 205, 70, 0.75), rgba(255, 190, 40, 0) 100%),
    radial-gradient(circle, rgba(255, 244, 180, 1) 0 1.6px, transparent 2.2px) 6px 0 / 11px 19px repeat-y,
    radial-gradient(circle, rgba(255, 244, 180, 0.9) 0 1.2px, transparent 1.8px) calc(100% - 6px) 8px / 9px 23px repeat-y;
  filter: blur(0.6px) drop-shadow(0 0 5px rgba(255, 200, 60, 0.7));
}
.egg.ice .trail {
  width: 38px; height: 110px;
  background:
    radial-gradient(ellipse 45% 100% at 50% 100%, rgba(165, 228, 255, 0.75), rgba(165, 228, 255, 0) 100%),
    radial-gradient(circle, rgba(240, 252, 255, 1) 0 1.6px, transparent 2.2px) 5px 0 / 11px 17px repeat-y,
    radial-gradient(circle, rgba(240, 252, 255, 0.9) 0 1.2px, transparent 1.8px) calc(100% - 5px) 6px / 9px 21px repeat-y;
  filter: blur(0.6px) drop-shadow(0 0 5px rgba(140, 215, 255, 0.8));
}
@keyframes trail-flicker { from { opacity: 0.7; transform: translateX(-50%) scaleX(0.9); } to { opacity: 1; transform: translateX(-50%) scaleX(1.05); } }
@media (prefers-reduced-motion: reduce) { .trail { display: none; } }
.snow-enter-active, .snow-leave-active { transition: opacity 0.6s; }
.snow-enter-from, .snow-leave-to { opacity: 0; }

.freeze-badge {
  position: absolute; top: 12px; right: 12px; z-index: 4; padding: 4px 12px; border-radius: 99px;
  background: rgba(20, 60, 90, 0.75); border: 2px solid rgba(160, 225, 255, 0.9);
  font-weight: 900; font-size: 18px; color: #dff4ff; font-variant-numeric: tabular-nums;
}

/* Тряска поля при пропущенном яйце. */
.field.shake { animation: field-shake 0.35s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
@keyframes field-shake {
  15% { transform: translate(-6px, 2px); }
  30% { transform: translate(5px, -3px); }
  45% { transform: translate(-4px, 1px); }
  60% { transform: translate(3px, 2px); }
  80% { transform: translate(-1px, -1px); }
}
@media (prefers-reduced-motion: reduce) { .field.shake { animation: none; } }
.combo {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  font-size: 28px; font-weight: 900; color: var(--gold); text-shadow: 0 3px 0 #6a3a16;
  animation: pop-in 0.2s ease;
}
.chicken { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); pointer-events: none; }
.overlay {
  position: absolute; inset: 0; background: rgba(20, 10, 4, 0.6); overflow-y: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; text-align: center;
}
.big { font-size: 32px; font-weight: 900; }
.no-energy :deep(.btn) { filter: saturate(0.5) brightness(0.8); }
.hint { max-width: 280px; }
.value {
  padding: 6px 14px; border-radius: 99px; font-weight: 900; font-size: 14px;
  background: rgba(0, 0, 0, 0.45); border: 2px solid var(--gold-dark); color: var(--gold);
}
</style>
