<script setup lang="ts">
// Плашка в шапке в стиле календаря: картинка-рамка с иконкой + подпись под иконкой.
// Используется для "Рейтинг" и "Друзья".
import { ref } from 'vue'

defineProps<{ src: string; label: string; fallbackIcon: string; dot?: boolean }>()
defineEmits<{ click: [] }>()

const imgFailed = ref(false)
</script>

<template>
  <button class="tile" :class="{ noimg: imgFailed }" :aria-label="label" @click="$emit('click')">
    <img v-if="!imgFailed" class="frame" :src="src" alt="" draggable="false" @error="imgFailed = true" />
    <span v-else class="icon">{{ fallbackIcon }}</span>
    <span class="label">{{ label }}</span>
    <span v-if="dot" class="dot" />
  </button>
</template>

<style scoped>
/* Координаты подписи — в % от картинки (600×227): иконка сверху, место под текст снизу. */
.tile {
  position: relative; display: block; width: 100%;
  aspect-ratio: var(--tile-ratio); container-type: size;
  transition: transform 0.1s;
}
.tile:active { transform: scale(0.96); }
.frame { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
.noimg { background: var(--surface-dark); border: 2px solid var(--surface-wood); border-radius: var(--radius-md); }
.icon { position: absolute; left: 0; right: 0; top: 12%; text-align: center; font-size: 34cqh; line-height: 1; }
.label {
  position: absolute; left: 6%; right: 6%; top: 55%; height: 30%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: max(10px, 21cqh); color: var(--cream); white-space: nowrap;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.7), 0 0 6px rgba(0, 0, 0, 0.35);
}
.dot {
  position: absolute; top: 4%; right: 2%; width: 12px; height: 12px; border-radius: 50%;
  background: var(--red-accent); box-shadow: 0 0 0 2px var(--background-dark);
}
</style>
