<script setup lang="ts">
// Ежедневная награда: 28 дней = 4 недели по 7 ячеек.
// Всё рисуется поверх рамки ui/uicalendar: заголовок на доске, дни в ячейках, таймер/кнопка на нижней планке.
// Стрелки по бокам листают недели 1–4.
import { computed, ref, watch } from 'vue'
import CoinIcon from '@/components/CoinIcon.vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { ECONOMY } from '@/config/economy'
import { ASSETS } from '@/config/assets'
import { rewardStatus, msUntilReward, effectiveStreakDay } from '@/economy/reward'
import { formatNumber, formatCompact } from '@/economy/format'
import { playSound } from '@/services/audio'
import { t } from '@/i18n'

const game = useGameStore()
const ui = useUiStore()

const WEEKS = Math.ceil(ECONOMY.rewardStreak.length / 7)

/** Позиции ячеек в % от рамки (замерено по картинке). */
const CELLS = [
  { l: 5.7, t: 22.0, w: 21.3, h: 28.9 },
  { l: 28.35, t: 22.0, w: 21.0, h: 28.9 },
  { l: 50.4, t: 22.0, w: 21.8, h: 28.9 },
  { l: 73.2, t: 22.0, w: 21.4, h: 28.9 },
  { l: 5.7, t: 53.4, w: 21.3, h: 28.1 },
  { l: 28.35, t: 53.4, w: 21.0, h: 28.1 },
  { l: 50.4, t: 53.4, w: 44.2, h: 28.1 },
]

const open = computed(() => ui.sheet === 'reward')
const ready = computed(() => !!game.state && rewardStatus(game.state.reward, game.now) === 'ready')
const today = computed(() => (game.state ? effectiveStreakDay(game.state.reward, game.now) : 0))
const waitMs = computed(() => (game.state ? msUntilReward(game.state.reward, game.now) : 0))

const week = ref(0)
watch(open, (v) => { if (v) week.value = Math.min(WEEKS - 1, Math.floor(today.value / 7)) }, { immediate: true })

const days = computed(() =>
  CELLS.map((c, k) => {
    const i = week.value * 7 + k
    return { i, c, coins: ECONOMY.rewardStreak[i] ?? 0, state: i < today.value ? 'done' : i === today.value ? 'today' : 'future', big: k === 6 }
  }),
)

function hms(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

function go(dir: 1 | -1) {
  const n = week.value + dir
  if (n < 0 || n >= WEEKS) return
  playSound('clickCalendar', 0.6)
  week.value = n
}

function pickWeek(n: number) {
  if (n === week.value) return
  playSound('clickCalendar', 0.6)
  week.value = n
}

async function claim() {
  if (!ready.value || game.pending === 'reward') return
  const res = await game.claimReward()
  if (res) ui.toast(t('reward.claimed', { n: formatNumber(res.coins) }), 'success')
}

function onCell(i: number) {
  if (i === today.value && ready.value) claim()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cal">
      <div v-if="open" class="backdrop" @click.self="ui.closeSheet()">
        <div class="wrap">
          <button class="arrow left" :disabled="week <= 0" aria-label="prev" @click="go(-1)">‹</button>

          <div class="frame">
            <img class="bg" :src="ASSETS.ui.calendarFrame" alt="" draggable="false" />

            <div class="plank">
              <div class="title">{{ t('reward.title') }}</div>
              <div class="week">{{ t('reward.week', { n: week + 1, total: WEEKS }) }}</div>
            </div>

            <button class="close" aria-label="close" @click="ui.closeSheet()" />

            <button
              v-for="d in days"
              :key="d.i"
              class="cell"
              :class="[d.state, { big: d.big, tappable: d.state === 'today' && ready }]"
              :style="{ left: d.c.l + '%', top: d.c.t + '%', width: d.c.w + '%', height: d.c.h + '%' }"
              @click="onCell(d.i)"
            >
              <span class="dname">{{ t('reward.day', { n: d.i + 1 }) }}</span>
              <span class="ico">
                <img v-if="d.big" class="gift" :src="ASSETS.ui.present" alt="" draggable="false" />
                <CoinIcon v-else :size="30" class="coin" />
              </span>
              <span class="val">{{ d.big ? formatNumber(d.coins) : formatCompact(d.coins) }}</span>
              <span v-if="d.state === 'done'" class="check">✔</span>
            </button>

            <div class="bar">
              <button v-if="ready" class="claim" :disabled="game.pending === 'reward'" @click="claim">
                {{ t('reward.tapToday', { n: today + 1 }) }}
              </button>
              <span v-else class="timer">{{ t('reward.nextIn', { time: hms(waitMs) }) }}</span>
            </div>
          </div>

          <button class="arrow right" :disabled="week >= WEEKS - 1" aria-label="next" @click="go(1)">›</button>
        </div>

        <div class="dots">
          <button v-for="w in WEEKS" :key="w" class="dot" :class="{ on: w - 1 === week }" @click="pickWeek(w - 1)" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0; z-index: 70; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 12px 4px; background: rgba(10, 5, 2, 0.72); backdrop-filter: blur(3px);
}
.wrap { position: relative; width: 100%; max-width: 560px; display: flex; align-items: center; }
.frame {
  position: relative; flex: 1; min-width: 0; aspect-ratio: 1100 / 688; container-type: inline-size;
  filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.6));
}
.bg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; user-select: none; }

/* Стрелки по бокам рамки */
.arrow {
  position: relative; z-index: 2; flex: 0 0 auto; width: 30px; height: 44px; margin: 0 -8px; border-radius: 12px;
  font-size: 30px; font-weight: 900; line-height: 1; color: #4a2a05;
  background: linear-gradient(180deg, #ffe08a, var(--gold) 55%, var(--gold-dark));
  border: 2px solid #6a3a16; box-shadow: 0 3px 0 #4a2a05, 0 0 12px rgba(245, 184, 46, 0.45);
}
.arrow:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #4a2a05; }
.arrow:disabled { opacity: 0.3; box-shadow: none; }

/* Заголовок на деревянной доске */
.plank {
  position: absolute; left: 6%; top: 3.5%; width: 44%; height: 15%;
  display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-1.2deg);
  pointer-events: none;
}
.title {
  font-size: 5.3cqw; font-weight: 900; line-height: 1; color: #fff3d6; white-space: nowrap;
  text-shadow: 0 0.35cqw 0 #5a2e10, 0 0 0.8cqw rgba(0, 0, 0, 0.6);
  -webkit-text-stroke: 0.25cqw #5a2e10; paint-order: stroke fill;
}
.week { margin-top: 0.3cqw; font-size: 2.1cqw; font-weight: 900; color: #ffd66b; text-shadow: 0 0.2cqw 0 #4a2208; }

.close { position: absolute; left: 88.2%; top: 6.3%; width: 9%; aspect-ratio: 1; border-radius: 50%; background: transparent; }
.close:active { background: rgba(0, 0, 0, 0.2); }

/* Ячейки */
.cell {
  position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6cqw;
  border-radius: 2.4cqw; background: transparent; color: #fff3d6; padding: 0;
}
.cell.big { flex-direction: row; gap: 3cqw; }
.cell.big .dname { position: absolute; top: 7%; left: 0; right: 0; }
.dname { font-size: 2.7cqw; font-weight: 900; color: #ffdf9a; text-shadow: 0 0.2cqw 0 #3a1a06; }
.ico { display: grid; place-items: center; height: 7cqw; }
.ico .coin { width: 6.6cqw !important; height: 6.6cqw !important; filter: drop-shadow(0 0.4cqw 0.4cqw rgba(0, 0, 0, 0.5)); }
.gift { height: 15cqw; width: auto; filter: drop-shadow(0 0 1.6cqw rgba(245, 184, 46, 0.7)); }
.cell.big .ico { height: auto; margin-top: 3cqw; }
.val { font-size: 3.4cqw; font-weight: 900; color: #fff; text-shadow: 0 0.3cqw 0 #3a1a06; font-variant-numeric: tabular-nums; }
.cell.big .val { font-size: 5cqw; color: var(--gold); margin-top: 3cqw; text-shadow: 0 0.4cqw 0 #5a2e10; }

.cell.done .ico, .cell.done .val, .cell.done .dname { opacity: 0.5; }
.check {
  position: absolute; right: 5%; top: 5%; display: grid; place-items: center; width: 5cqw; height: 5cqw; border-radius: 50%;
  font-size: 3cqw; font-weight: 900; color: #fff; background: radial-gradient(circle at 40% 35%, #8ef07a, #2f9e2a);
  border: 0.35cqw solid #1d5e19; box-shadow: 0 0.3cqw 0 #16460f;
}
.cell.today {
  background: rgba(245, 184, 46, 0.12);
  box-shadow: inset 0 0 0 0.6cqw #ffd35a, 0 0 2.4cqw rgba(255, 200, 70, 0.8), inset 0 0 3cqw rgba(255, 200, 70, 0.35);
}
.cell.tappable { animation: glow 1.2s ease-in-out infinite; }
.cell.tappable .ico { animation: bob 1.2s ease-in-out infinite; }
@keyframes glow { 50% { box-shadow: inset 0 0 0 0.6cqw #fff0a8, 0 0 4cqw rgba(255, 210, 90, 1), inset 0 0 4cqw rgba(255, 200, 70, 0.5); } }
@keyframes bob { 50% { transform: translateY(-0.8cqw); } }

/* Нижняя планка */
.bar {
  position: absolute; left: 20%; right: 20%; top: 87%; height: 9.4%;
  display: flex; align-items: center; justify-content: center;
}
.timer {
  font-size: 3.2cqw; font-weight: 900; color: #fff3d6; white-space: nowrap; font-variant-numeric: tabular-nums;
  text-shadow: 0 0.3cqw 0 #3a1a06;
}
.claim {
  height: 90%; padding: 0 5cqw; border-radius: 99px; font-size: 3.2cqw; font-weight: 900; color: #4a2a05; white-space: nowrap;
  background: linear-gradient(180deg, #fff0a8, var(--gold) 60%, var(--gold-dark));
  border: 0.3cqw solid #6a3a16; box-shadow: 0 0.4cqw 0 #4a2a05, 0 0 2cqw rgba(255, 210, 90, 0.8);
}
.claim:disabled { opacity: 0.6; }

.dots { display: flex; gap: 8px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255, 255, 255, 0.25); padding: 0; }
.dot.on { background: var(--gold); box-shadow: 0 0 8px rgba(245, 184, 46, 0.8); }

.cal-enter-active { transition: opacity 0.2s; }
.cal-enter-active .frame { animation: pop 0.35s cubic-bezier(0.3, 1.4, 0.5, 1); }
.cal-leave-active { transition: opacity 0.15s; }
.cal-enter-from, .cal-leave-to { opacity: 0; }
@keyframes pop { from { transform: scale(0.7); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .cell.tappable, .cell.tappable .ico { animation: none; } }
</style>
