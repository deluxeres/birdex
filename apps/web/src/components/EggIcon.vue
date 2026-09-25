<script setup lang="ts">
// Иконка яйца для всей игры. Картинки: ASSETS.eggs.normal / golden / ice.
// Нет файла золотого/ледяного — обычное яйцо с оттенком. Нет никакого — emoji.
import { computed, ref } from 'vue'
import { ASSETS } from '@/config/assets'

const props = withDefaults(defineProps<{ size?: number; golden?: boolean; ice?: boolean }>(), {
  size: 20,
  golden: false,
  ice: false,
})

const special = computed<'golden' | 'ice' | null>(() => (props.ice ? 'ice' : props.golden ? 'golden' : null))
const specialFailed = ref(false)
const normalFailed = ref(false)

const useSpecialFile = computed(() => special.value !== null && !specialFailed.value)
const src = computed(() => (useSpecialFile.value ? ASSETS.eggs[special.value!] : ASSETS.eggs.normal))
const tint = computed(() => (special.value && !useSpecialFile.value ? special.value : null))

function onError() {
  if (useSpecialFile.value) specialFailed.value = true
  else normalFailed.value = true
}
</script>

<template>
  <span class="egg-icon" :class="tint && 'tint-' + tint" :style="{ width: size + 'px', height: size + 'px' }">
    <img v-if="!normalFailed" :src="src" alt="" draggable="false" @error="onError" />
    <span v-else class="emoji" :style="{ fontSize: size * 0.9 + 'px' }">🥚</span>
  </span>
</template>

<style scoped>
.egg-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; vertical-align: middle; }
img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.emoji { line-height: 1; }
.tint-golden { filter: sepia(1) saturate(5) hue-rotate(-12deg) brightness(1.1) drop-shadow(0 0 6px rgba(245, 184, 46, 0.9)); }
.tint-ice { filter: grayscale(1) sepia(1) saturate(4) hue-rotate(160deg) brightness(1.25) drop-shadow(0 0 8px rgba(120, 210, 255, 0.95)); }
</style>
