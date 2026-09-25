<script setup lang="ts">
// Надпись "Уровень N!" при повышении уровня: вспышка, лучи, искры — и плавно тает.
// Следит за уровнем игрока сама; ставится один раз в App.vue.
import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { playSound } from '@/services/audio'
import { haptics } from '@/services/haptics'
import { t } from '@/i18n'

const game = useGameStore()
const shown = ref<number | null>(null)
let hideTimer: number | undefined

const sparks = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (360 / 12) * i + Math.random() * 12,
  dist: 90 + Math.random() * 50,
  delay: Math.random() * 0.15,
}))

watch(
  () => game.profile?.level,
  (now, before) => {
    if (!now || !before || now <= before) return
    shown.value = now
    playSound('lvlup', 0.45) // не слишком громко
    haptics.success()
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => (shown.value = null), 2300)
  },
)
</script>

<template>
  <Transition name="lvl">
    <div v-if="shown" :key="shown" class="lvlup" aria-live="polite">
      <div class="rays" />
      <div class="glow" />
      <span
        v-for="s in sparks"
        :key="s.id"
        class="spark"
        :style="{ '--a': s.angle + 'deg', '--d': s.dist + 'px', animationDelay: s.delay + 's' }"
      />
      <div class="text">
        <div class="small">{{ t('levelUp.title') }}</div>
        <div class="num">{{ t('levelUp.level', { n: shown }) }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.lvlup {
  position: fixed; left: 0; right: 0; top: 34%; z-index: 70; height: 0;
  display: flex; justify-content: center; pointer-events: none;
}
.text {
  position: absolute; transform: translateY(-50%); text-align: center;
  animation: pop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
.small {
  font-size: 15px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase;
  color: #fff4d0; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 200, 80, 0.8);
}
.num {
  font-size: 46px; font-weight: 900; line-height: 1.05; white-space: nowrap;
  background: linear-gradient(180deg, #fff7d1 0%, #ffd35c 45%, #e89a12 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  -webkit-text-stroke: 1.5px #6a3a08;
  filter: drop-shadow(0 4px 0 rgba(60, 30, 5, 0.7)) drop-shadow(0 0 14px rgba(255, 190, 60, 0.7));
}
.glow {
  position: absolute; width: 280px; height: 280px; border-radius: 50%; transform: translate(0, -50%);
  background: radial-gradient(circle, rgba(255, 225, 140, 0.55) 0%, rgba(255, 190, 60, 0.18) 45%, transparent 70%);
  animation: glow 2.3s ease-out both;
}
.rays {
  position: absolute; width: 380px; height: 380px; border-radius: 50%; transform: translate(0, -50%);
  background: repeating-conic-gradient(from 0deg, rgba(255, 220, 130, 0.35) 0deg 7deg, transparent 7deg 24deg);
  -webkit-mask: radial-gradient(circle, #000 15%, transparent 65%);
  mask: radial-gradient(circle, #000 15%, transparent 65%);
  animation: rays 2.3s linear both;
}
.spark {
  position: absolute; width: 8px; height: 8px; border-radius: 50%; top: 0;
  background: radial-gradient(circle, #fff 0%, #ffd35c 60%, transparent 70%);
  transform: rotate(var(--a)) translateX(0); opacity: 0;
  animation: spark 1s ease-out both;
}
@keyframes pop {
  0% { transform: translateY(-50%) scale(0.3); opacity: 0; }
  100% { transform: translateY(-50%) scale(1); opacity: 1; }
}
@keyframes glow {
  0% { opacity: 0; transform: translate(0, -50%) scale(0.4); }
  20% { opacity: 1; transform: translate(0, -50%) scale(1); }
  100% { opacity: 0.6; transform: translate(0, -50%) scale(1.15); }
}
@keyframes rays {
  0% { opacity: 0; transform: translate(0, -50%) rotate(0deg) scale(0.5); }
  20% { opacity: 1; }
  100% { opacity: 0.5; transform: translate(0, -50%) rotate(40deg) scale(1.1); }
}
@keyframes spark {
  0% { opacity: 0; transform: rotate(var(--a)) translateX(10px) scale(0.5); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--a)) translateX(var(--d)) scale(0.2); }
}
/* плавное затухание всей надписи */
.lvl-leave-active { transition: opacity 0.6s ease, transform 0.6s ease; }
.lvl-leave-to { opacity: 0; transform: translateY(-16px); }
@media (prefers-reduced-motion: reduce) {
  .rays, .spark { display: none; }
  .text { animation: none; }
}
</style>
