<script setup lang="ts">
// Лёгкий снегопад поверх поля (еле заметный). Включается/выключается через v-if + Transition.
// Снежинки — CSS, без JS-цикла; случайные размер, скорость, покачивание.
const rand = (a: number, b: number) => a + Math.random() * (b - a)

const flakes = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: rand(0, 100),
  size: rand(3, 8),
  dur: rand(5, 9),
  delay: rand(-9, 0),
  sway: rand(10, 30),
  opacity: rand(0.25, 0.55),
}))
</script>

<template>
  <div class="snow" aria-hidden="true">
    <span
      v-for="f in flakes"
      :key="f.id"
      class="flake"
      :style="{
        left: f.left + '%',
        width: f.size + 'px',
        height: f.size + 'px',
        opacity: f.opacity,
        animationDuration: f.dur + 's, ' + f.dur / 2 + 's',
        animationDelay: f.delay + 's, ' + f.delay + 's',
        '--sway': f.sway + 'px',
      }"
    />
  </div>
</template>

<style scoped>
.snow { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 3; }
.flake {
  position: absolute; top: -10px; border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, rgba(230, 245, 255, 0.8) 45%, transparent 70%);
  animation-name: fall, sway;
  animation-timing-function: linear, ease-in-out;
  animation-iteration-count: infinite, infinite;
  animation-direction: normal, alternate;
}
@keyframes fall { to { top: 105%; } }
@keyframes sway { from { transform: translateX(calc(var(--sway) * -1)); } to { transform: translateX(var(--sway)); } }
@media (prefers-reduced-motion: reduce) { .snow { display: none; } }
</style>
