<script setup lang="ts">
// Сцена фермы: крупная курица-герой, стрелки смены фона по бокам.
// Сам фон рисует GameBackground в FarmScreen (на весь экран).
import { ref, watch } from 'vue'
import ChickenAvatar from '@/components/ChickenAvatar.vue'
import EggIcon from '@/components/EggIcon.vue'
import HeartBurst from '@/components/effects/HeartBurst.vue'
import SwapSparkle from '@/components/effects/SwapSparkle.vue'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { t } from '@/i18n'

const props = defineProps<{ chickenKey: string | null; perHour: number; bgIndex: number; bgTotal: number }>()
defineEmits<{ pick: []; prevBg: []; nextBg: [] }>()

const scene = ref<HTMLElement | null>(null)
const hearts = ref<InstanceType<typeof HeartBurst> | null>(null)
const sparkle = ref<InstanceType<typeof SwapSparkle> | null>(null)
const heroEl = ref<HTMLElement | null>(null)

/** Смена курицы на ферме: вспышка + звёздочки в центре курицы. */
watch(
  () => props.chickenKey,
  (next, prev) => {
    if (!next || !prev || next === prev) return
    const s = scene.value?.getBoundingClientRect()
    const h = heroEl.value?.getBoundingClientRect()
    if (s && h) sparkle.value?.play(h.left - s.left + h.width / 2, h.top - s.top + h.height * 0.55)
    haptics.medium()
  },
)

const happy = ref(false)
let happyTimer: number | undefined

/** Тап по курице: перья и сердечки из точки касания + прыжок + кудахтанье. */
function poke(ev: PointerEvent) {
  const rect = scene.value?.getBoundingClientRect()
  if (rect) hearts.value?.burst(ev.clientX - rect.left, ev.clientY - rect.top)
  playSound('chickenFarm', 0.7, 0.06)
  haptics.light()
  // Перезапуск анимации прыжка даже при частых тапах.
  happy.value = false
  window.clearTimeout(happyTimer)
  requestAnimationFrame(() => {
    happy.value = true
    happyTimer = window.setTimeout(() => (happy.value = false), 500)
  })
}
</script>

<template>
  <section ref="scene" class="scene">
    <div class="rate"><EggIcon :size="16" /> {{ t('farm.perHour', { n: perHour }) }}</div>
    <button class="pick" @click="$emit('pick')">
      <span class="pick-ava"><ChickenAvatar :chicken-key="chickenKey ?? 'farm_hen'" :size="26" :idle="false" /></span>
      <span class="pick-text">{{ t('farm.chooseChicken') }}</span>
      <span class="pick-arrows" aria-hidden="true">⇄</span>
    </button>

    <button v-if="bgTotal > 1" class="arrow left" :aria-label="t('farm.prevBg')" @click="$emit('prevBg')">‹</button>
    <button v-if="bgTotal > 1" class="arrow right" :aria-label="t('farm.nextBg')" @click="$emit('nextBg')">›</button>

    <SwapSparkle ref="sparkle" />

    <div ref="heroEl" class="hero-slot">
      <Transition name="swap" mode="out-in">
        <button v-if="chickenKey" :key="chickenKey" class="hero" :class="{ happy }" @pointerdown="poke">
          <ChickenAvatar :chicken-key="chickenKey" :size="230" />
        </button>
      </Transition>
    </div>

    <HeartBurst ref="hearts" />

    <div v-if="bgTotal > 1" class="dots">
      <span v-for="i in bgTotal" :key="i" class="dot" :class="{ on: i - 1 === bgIndex }" />
    </div>

  </section>
</template>

<style scoped>
.scene { position: relative; flex: 1; min-height: 270px; }
.hero-slot {
  position: absolute; left: 52%; bottom: -4px; width: 230px; height: 230px;
  transform: translateX(-50%); z-index: 2;
}
.hero { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); }

/* Смена курицы: старая крутится и тает, новая выпрыгивает с пружинкой. */
.swap-leave-active { animation: swap-out 0.22s ease-in forwards; }
.swap-enter-active { animation: swap-in 0.6s cubic-bezier(0.25, 1.5, 0.45, 1) both; }
@keyframes swap-out {
  to { transform: translateX(-50%) scale(0.3) rotate(-25deg); opacity: 0; filter: brightness(2.5); }
}
@keyframes swap-in {
  0% { transform: translateX(-50%) translateY(30px) scale(0.2); opacity: 0; filter: brightness(3); }
  55% { opacity: 1; filter: brightness(1.4); }
  100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; filter: brightness(1); }
}
@media (prefers-reduced-motion: reduce) {
  .swap-leave-active, .swap-enter-active { animation-duration: 0.01s; }
}
.hero { transform-origin: 50% 100%; touch-action: manipulation; }
.hero.happy { animation: hop 0.5s cubic-bezier(0.3, 0.7, 0.4, 1); }
/* присела → подпрыгнула → мягко приземлилась */
@keyframes hop {
  0% { transform: translateX(-50%) scale(1, 1); }
  15% { transform: translateX(-50%) scale(1.08, 0.9); }
  45% { transform: translateX(-50%) translateY(-22px) scale(0.95, 1.06); }
  75% { transform: translateX(-50%) translateY(0) scale(1.04, 0.96); }
  100% { transform: translateX(-50%) scale(1, 1); }
}
.rate {
  position: absolute; top: 4px; left: 0; padding: 6px 10px; border-radius: 99px;
  background: rgba(0, 0, 0, 0.5); font-size: 13px; display: flex; align-items: center; gap: 4px;
}
/* Кнопка "Выбрать курицу": деревянная плашка в золотой рамке с портретом текущей курицы. */
.pick {
  position: absolute; top: 0; right: 0; z-index: 3;
  display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px;
  border-radius: 14px; border: 2px solid var(--gold);
  background: linear-gradient(180deg, #7a5130 0%, #4a2f1a 100%);
  box-shadow: 0 3px 0 #2a1a0d, inset 0 1px 0 rgba(255, 230, 160, 0.35), 0 0 12px rgba(245, 184, 46, 0.35);
  color: var(--cream); font-size: 13px; font-weight: 900; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
  transition: transform 0.1s, box-shadow 0.1s;
}
.pick:active { transform: translateY(2px); box-shadow: 0 1px 0 #2a1a0d, inset 0 1px 0 rgba(255, 230, 160, 0.35); }
.pick-ava {
  width: 30px; height: 30px; border-radius: 10px; overflow: hidden; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 35%, #ffe7a3, #d9982a 70%, #9a6412);
  box-shadow: inset 0 0 0 2px rgba(255, 245, 210, 0.6);
}
.pick-arrows { color: var(--gold); font-size: 15px; line-height: 1; }
.arrow {
  position: absolute; top: 52%; transform: translateY(-50%);
  width: 40px; height: 56px; border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.45); border: 2px solid rgba(255, 255, 255, 0.15);
  font-size: 34px; font-weight: 900; line-height: 1;
  transition: transform 0.1s, background 0.15s;
  z-index: 3;
}
.arrow:active { transform: translateY(-50%) scale(0.9); background: rgba(0, 0, 0, 0.65); }
.arrow.left { left: -6px; }
.arrow.right { right: -6px; }
.dots { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, 0.35); transition: all 0.2s; }
.dot.on { background: var(--gold); width: 18px; border-radius: 99px; }
</style>
