<script setup lang="ts">
// Вкладка 3 — Курочки: 36 куриц, 4 страницы по 9, фильтр по редкости, детали и улучшение.
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { CHICKENS, CHICKENS_PER_PAGE } from '@/config/chickens'
import type { Rarity } from '@/types/game'
import { playSound } from '@/services/audio'
import ChickenCard from './ChickenCard.vue'
import ChickenDetails from './ChickenDetails.vue'
import CoinBalance from '@/components/CoinBalance.vue'
import { t } from '@/i18n'

const game = useGameStore()
const ui = useUiStore()

type Filter = 'all' | 'owned' | Rarity
const filter = ref<Filter>('all')
const FILTERS: Filter[] = ['all', 'owned', 'common', 'uncommon', 'rare', 'epic', 'legendary']

const list = computed(() =>
  CHICKENS.filter((c) => {
    if (filter.value === 'all') return true
    if (filter.value === 'owned') return game.ownsChicken(c.key)
    return c.rarity === filter.value
  }),
)

const page = ref(0)
const dir = ref<1 | -1>(1)
const pages = computed(() => Math.max(1, Math.ceil(list.value.length / CHICKENS_PER_PAGE)))
const pageItems = computed(() => list.value.slice(page.value * CHICKENS_PER_PAGE, (page.value + 1) * CHICKENS_PER_PAGE))
watch(filter, () => (page.value = 0))

function turn(d: 1 | -1) {
  const next = page.value + d
  if (next < 0 || next >= pages.value) return
  dir.value = d
  page.value = next
  playSound('click', 0.5)
}

const selected = computed(() => ui.selectedChickenKey ?? game.displayedChicken?.key ?? CHICKENS[0].key)
const levelOf = (key: string) => game.chickens.find((c) => c.key === key)?.level ?? null
const label = (f: Filter) => (f === 'all' || f === 'owned' ? t(`chickens.${f}`) : t(`rarity.${f}`))
</script>

<template>
  <div class="screen">
    <div class="row">
      <h1 class="screen-title">🐔 {{ t('chickens.title') }}</h1>
      <div class="spacer" />
      <CoinBalance />
      <span class="collected">{{ t('chickens.collected', { n: game.chickens.length, total: CHICKENS.length }) }}</span>
    </div>

    <ChickenDetails :chicken-key="selected" />

    <div class="filters">
      <button v-for="f in FILTERS" :key="f" class="chip" :class="{ on: filter === f }" @click="filter = f">
        {{ label(f) }}
      </button>
    </div>

    <div class="pager">
      <button class="arrow" :disabled="page === 0" :aria-label="t('chickens.prevPage')" @click="turn(-1)">‹</button>
      <Transition :name="dir > 0 ? 'slide-next' : 'slide-prev'" mode="out-in">
        <div :key="filter + page" class="grid">
          <ChickenCard
            v-for="c in pageItems"
            :key="c.key"
            :chicken-key="c.key"
            :level="levelOf(c.key)"
            :selected="c.key === selected"
            @select="ui.selectedChickenKey = c.key"
          />
        </div>
      </Transition>
      <button class="arrow" :disabled="page >= pages - 1" :aria-label="t('chickens.nextPage')" @click="turn(1)">›</button>
    </div>

    <div v-if="pages > 1" class="dots">
      <span v-for="i in pages" :key="i" class="dot" :class="{ on: i - 1 === page }" />
      <span class="muted pnum">{{ page + 1 }} / {{ pages }}</span>
    </div>
    <p v-if="list.length === 0" class="muted empty">{{ t('chickens.empty') }}</p>
  </div>
</template>

<style scoped>
.screen-title { white-space: nowrap; font-size: 20px; }
.collected { font-size: 13px; font-weight: 900; color: var(--gold); padding: 4px 10px; border-radius: 99px; background: rgba(0, 0, 0, 0.4); }
.filters { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.chip {
  flex: 0 0 auto; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px;
  background: var(--surface-dark); border: 2px solid var(--surface-wood); color: var(--text-secondary);
}
.chip.on { background: var(--gold); color: #4a2a05; border-color: var(--gold-dark); }
.pager { display: grid; grid-template-columns: 28px 1fr 28px; align-items: center; gap: 4px; }
.arrow {
  height: 64px; border-radius: var(--radius-sm); background: rgba(0, 0, 0, 0.45);
  border: 2px solid rgba(255, 255, 255, 0.12); font-size: 26px; font-weight: 900; line-height: 1;
}
.arrow:disabled { opacity: 0.25; }
.arrow:active:not(:disabled) { transform: scale(0.92); }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; min-width: 0; }
.dots { display: flex; justify-content: center; align-items: center; gap: 6px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255, 255, 255, 0.3); transition: all 0.2s; }
.dot.on { background: var(--gold); width: 18px; border-radius: 99px; }
.pnum { font-size: 12px; margin-left: 6px; }
.empty { text-align: center; }

.slide-next-enter-active, .slide-next-leave-active, .slide-prev-enter-active, .slide-prev-leave-active { transition: transform 0.18s ease, opacity 0.18s; }
.slide-next-enter-from, .slide-prev-leave-to { transform: translateX(30px); opacity: 0; }
.slide-next-leave-to, .slide-prev-enter-from { transform: translateX(-30px); opacity: 0; }
</style>
