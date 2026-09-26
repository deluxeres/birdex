import { describe, it, expect } from 'vitest'
import { ECONOMY } from '@/config/economy'
import { chickenProduction, accumulatedEggs } from './production'
import { storageCapacity, storageUpgradeCost, STORAGE_MAX_LEVEL } from './storage'
import { xpForLevel, levelForXp, referencePerHour } from './progression'
import { currentEnergy, energyMaxForLevel, energyUpgradeCost, ENERGY_MAX_LEVEL, msUntilPlayable } from './energy'
import { spawnIntervalMs, fallDurationMs } from './playDifficulty'
import { CHICKENS } from '@/config/chickens'
import { upgradeCost } from './upgrade'
import { sellValue, eggsForPercent, clampSellAmount } from './market'
import { rewardStatus, effectiveStreakDay, rewardAmount } from './reward'
import { comboMultiplier } from './combo'
import { msUntilNextDay } from './dayClock'

const H = 3_600_000

describe('production', () => {
  it('36 chickens, first ones as designed', () => {
    expect(CHICKENS).toHaveLength(36)
    expect(CHICKENS.slice(0, 5).map((c) => c.baseProductionPerHour)).toEqual([30, 70, 100, 150, 320])
    expect(new Set(CHICKENS.map((c) => c.key)).size).toBe(36)
    expect(CHICKENS.every((c) => c.maxLevel === 15)).toBe(true)
  })
  it('+20% per level, max at 15', () => {
    expect(chickenProduction('farm_hen', 1)).toBe(30)
    expect(chickenProduction('farm_hen', 2)).toBe(36)
    expect(chickenProduction('farm_hen', 15)).toBe(385)
  })
  it('storage upgrades 1 000 → 50 000 000', () => {
    expect(storageCapacity(0)).toBe(1000)
    expect(storageCapacity(STORAGE_MAX_LEVEL)).toBe(50_000_000)
    expect(STORAGE_MAX_LEVEL).toBe(29)
    for (let l = 0; l < STORAGE_MAX_LEVEL; l++) {
      expect(storageCapacity(l + 1)).toBeGreaterThan(storageCapacity(l))
      expect(storageUpgradeCost(l + 1) >= storageUpgradeCost(l)).toBe(true)
    }
    expect(storageUpgradeCost(0)).toBe(700)
  })
  it('offline cap is 8 hours', () => {
    const eggs = accumulatedEggs({
      perHour: 100, lastProductionAt: 0, now: 24 * H, eggsInStorage: 0, storageCapacity: 1e9,
    })
    expect(eggs).toBe(800)
  })
  it('respects storage capacity', () => {
    const eggs = accumulatedEggs({
      perHour: 100, lastProductionAt: 0, now: 8 * H, eggsInStorage: 950, storageCapacity: 1000,
    })
    expect(eggs).toBe(50)
  })
  it('never negative when clock goes back', () => {
    const eggs = accumulatedEggs({
      perHour: 100, lastProductionAt: 10 * H, now: 0, eggsInStorage: 0, storageCapacity: 1000,
    })
    expect(eggs).toBe(0)
  })
  it('energy regen is capped', () => {
    expect(currentEnergy({ energy: 900, energyMax: 1000, energyUpdatedAt: 0, now: 99 * H })).toBe(1000)
  })
  it('bonus energy above max is kept', () => {
    expect(currentEnergy({ energy: 500, energyMax: 300, energyUpdatedAt: 0, now: 8 * H })).toBe(500)
  })
  it('energy fully refills in 8h', () => {
    expect(currentEnergy({ energy: 0, energyMax: 300, energyUpdatedAt: 0, now: 4 * H })).toBe(150)
    expect(currentEnergy({ energy: 0, energyMax: 300, energyUpdatedAt: 0, now: 8 * H })).toBe(300)
    // попытка стоит 50: из нуля на 300-максимуме ждать 50 / 300 × 8 ч = 80 мин
    expect(msUntilPlayable(0, 300)).toBe(80 * 60_000)
  })
  it('energy upgrades 300 → 1000 by 50, first is expensive', () => {
    expect(energyMaxForLevel(0)).toBe(300)
    expect(energyMaxForLevel(ENERGY_MAX_LEVEL)).toBe(1000)
    expect(ENERGY_MAX_LEVEL).toBe(14)
    expect(energyUpgradeCost(0)).toBe(2000)
    expect(energyUpgradeCost(1)).toBe(10000)
    expect(energyUpgradeCost(4)).toBe(400000)
    expect(energyUpgradeCost(ENERGY_MAX_LEVEL - 1)).toBeGreaterThan(energyUpgradeCost(4))
  })
})

describe('upgrade', () => {
  it('first upgrade pays back in ~12h', () => {
    expect(upgradeCost('farm_hen', 1)).toBe(360)
  })
  it('cost grows faster than income (long progression)', () => {
    expect(upgradeCost('farm_hen', 14)).toBeGreaterThan(upgradeCost('farm_hen', 1) * 50)
  })
})

describe('market', () => {
  it('sell value', () => {
    expect(sellValue(100, 5)).toBe(500)
    expect(sellValue(-5, 5)).toBe(0)
  })
  it('percent and clamp', () => {
    expect(eggsForPercent(1248, 25)).toBe(312)
    expect(clampSellAmount(5000, 1248)).toBe(1248)
    expect(clampSellAmount(NaN, 10)).toBe(0)
  })
})

describe('reward (days by New York time)', () => {
  // 2026-09-25 10:00 в Нью-Йорке (UTC-4) = 14:00 UTC
  const ny = (d: string, h: number) => Date.parse(`${d}T${String(h + 4).padStart(2, '0')}:00:00Z`)
  it('ready on first claim', () => {
    expect(rewardStatus({ streakDay: 0, lastClaimAt: null }, 0)).toBe('ready')
  })
  it('once per NY day', () => {
    expect(rewardStatus({ streakDay: 1, lastClaimAt: ny('2026-09-25', 1) }, ny('2026-09-25', 19))).toBe('wait')
    expect(rewardStatus({ streakDay: 1, lastClaimAt: ny('2026-09-25', 19) }, ny('2026-09-26', 0))).toBe('ready')
  })
  it('streak continues next day', () => {
    expect(effectiveStreakDay({ streakDay: 3, lastClaimAt: ny('2026-09-25', 19) }, ny('2026-09-26', 1))).toBe(3)
  })
  it('streak resets after a missed day', () => {
    expect(effectiveStreakDay({ streakDay: 4, lastClaimAt: ny('2026-09-25', 10) }, ny('2026-09-27', 10))).toBe(0)
  })
  it('timer counts to NY midnight', () => {
    expect(msUntilNextDay(ny('2026-09-25', 18))).toBe(6 * H)
  })
  it('handles DST end (25h day)', () => {
    // 1 ноября 2026 в США переводят часы: полночь 2 ноября — это 05:00 UTC
    expect(msUntilNextDay(Date.parse('2026-11-01T04:00:00Z'))).toBe(25 * H)
  })
  it('amount clamps to last day', () => {
    expect(ECONOMY.rewardStreak).toHaveLength(28)
    expect(rewardAmount(99)).toBe(40000)
  })
})

describe('player level', () => {
  it('level grows with coins spent, capped at 50', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(xpForLevel(2))).toBe(2)
    expect(levelForXp(1e12)).toBe(50)
  })
  it('reference farm grows with spending', () => {
    expect(referencePerHour(0)).toBe(30)
    expect(referencePerHour(1e7)).toBeGreaterThan(referencePerHour(1e5))
  })
})

describe('play difficulty', () => {
  it('gets faster with every egg, but has a floor', () => {
    expect(spawnIntervalMs(0)).toBeCloseTo(294.12)
    expect(spawnIntervalMs(60)).toBeLessThan(200)
    expect(fallDurationMs(0)).toBe(ECONOMY.play.fallStartMs)
    expect(fallDurationMs(1000)).toBe(ECONOMY.play.fallMinMs)
  })
})

describe('combo', () => {
  it('steps up', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(5)).toBe(2)
    expect(comboMultiplier(100)).toBe(5)
  })
})
