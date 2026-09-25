<script setup lang="ts">
// Полноэкранный фон за контентом вкладки. Плавно меняется при смене src.
// Если файла ещё нет — показывается запасной градиент.
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{ src: string; fallback?: string; dim?: number }>(), {
  fallback: 'linear-gradient(180deg, #f7c77a 0%, #e9a255 30%, #7a9a3f 58%, #3f5520 100%)',
  dim: 0.15,
})

const failed = ref<Record<string, boolean>>({})
// Два слоя для кроссфейда: старый уходит, новый проявляется.
const layers = ref<{ id: number; src: string }[]>([{ id: 0, src: props.src }])
let nextId = 1

watch(
  () => props.src,
  (src) => {
    layers.value = [...layers.value.slice(-1), { id: nextId++, src }]
    setTimeout(() => (layers.value = layers.value.slice(-1)), 450)
  },
)
</script>

<template>
  <div class="bg" :style="{ background: fallback }">
    <TransitionGroup name="fade">
      <img
        v-for="l in layers"
        v-show="!failed[l.src]"
        :key="l.id"
        :src="l.src"
        alt=""
        draggable="false"
        @error="failed = { ...failed, [l.src]: true }"
      />
    </TransitionGroup>
    <div class="dim" :style="{ opacity: dim }" />
  </div>
</template>

<style scoped>
.bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: center bottom;
}
.dim { position: absolute; inset: 0; background: #000; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
