<script setup lang="ts">
// Эффект появления: золотая вспышка + вращающиеся лучи + звёздочки врассыпную.
// Родитель вызывает play(x, y) через ref. Только transform/opacity.
import { ref } from 'vue'

interface Star { id: number; dx: number; dy: number; size: number; delay: number; rot: number; hue: 0 | 1 }
interface Flash { id: number; x: number; y: number; stars: Star[] }

const flashes = ref<Flash[]>([])
let nextId = 1
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function play(x: number, y: number) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const n = reduce ? 0 : 14
  const stars: Star[] = []
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + rand(-0.2, 0.2)
    const d = rand(80, 150)
    stars.push({
      id: nextId++,
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d * 0.8 - 20,
      size: rand(10, 20),
      delay: rand(60, 160),
      rot: rand(-180, 180),
      hue: (i % 2) as 0 | 1,
    })
  }
  const id = nextId++
  flashes.value = [...flashes.value, { id, x, y, stars }].slice(-2)
  setTimeout(() => (flashes.value = flashes.value.filter((f) => f.id !== id)), 1400)
}

defineExpose({ play })
</script>

<template>
  <div class="layer" aria-hidden="true">
    <div v-for="f in flashes" :key="f.id" class="flash" :style="{ left: f.x + 'px', top: f.y + 'px' }">
      <span class="rays" />
      <span class="glow" />
      <svg
        v-for="s in f.stars"
        :key="s.id"
        class="star"
        :class="'h' + s.hue"
        viewBox="0 0 24 24"
        :width="s.size"
        :height="s.size"
        :style="{ '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--rot': s.rot + 'deg', animationDelay: s.delay + 'ms' }"
      >
        <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.layer { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.flash { position: absolute; width: 0; height: 0; }

.glow {
  position: absolute; left: 0; top: 0; width: 220px; height: 220px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 180, 0.95) 0%, rgba(255, 200, 80, 0.55) 30%, rgba(255, 180, 40, 0) 70%);
  transform: translate(-50%, -50%) scale(0.2); opacity: 0;
  animation: glow 0.9s ease-out forwards;
}
@keyframes glow {
  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
  25% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

.rays {
  position: absolute; left: 0; top: 0; width: 300px; height: 300px; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255, 225, 140, 0.55) 0deg 8deg, transparent 8deg 30deg);
  -webkit-mask: radial-gradient(circle, #000 20%, transparent 68%);
  mask: radial-gradient(circle, #000 20%, transparent 68%);
  transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0;
  animation: rays 1.2s ease-out forwards;
}
@keyframes rays {
  0% { transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0; }
  25% { opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(1.1) rotate(70deg); opacity: 0; }
}

.star {
  position: absolute; left: 0; top: 0; opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  animation: star 0.95s cubic-bezier(0.15, 0.8, 0.3, 1) forwards;
  filter: drop-shadow(0 0 4px rgba(255, 210, 90, 0.9));
}
.h0 path { fill: #fff3c4; }
.h1 path { fill: #ffc93c; }
@keyframes star {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(0); }
  20% { opacity: 1; transform: translate(calc(-50% + var(--dx) * 0.4), calc(-50% + var(--dy) * 0.4)) scale(1.2) rotate(calc(var(--rot) * 0.4)); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.3) rotate(var(--rot)); }
}

@media (prefers-reduced-motion: reduce) {
  .rays { display: none; }
}
</style>
