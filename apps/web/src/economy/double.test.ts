import { describe, expect, it } from 'vitest'
import { DOUBLE_LAYOUT, DOUBLE_SLOTS, doubleReward, doubleSlotColor, randomDoubleSlot } from './double'

describe('double wheel', () => {
  it('38 слотов: 18 красных, 18 чёрных, 2 зелёных сверху и снизу', () => {
    expect(DOUBLE_LAYOUT).toHaveLength(38)
    expect(DOUBLE_LAYOUT.filter((c) => c === 'red')).toHaveLength(18)
    expect(DOUBLE_LAYOUT.filter((c) => c === 'black')).toHaveLength(18)
    expect(doubleSlotColor(0)).toBe('green')
    expect(doubleSlotColor(19)).toBe('green')
  })
  it('красный и чёрный идут через один', () => {
    for (let i = 1; i < DOUBLE_SLOTS; i++) {
      const a = DOUBLE_LAYOUT[i]
      const b = DOUBLE_LAYOUT[(i + 1) % DOUBLE_SLOTS]
      if (a !== 'green' && b !== 'green') expect(a).not.toBe(b)
    }
  })
  it('выплаты x2 / x14', () => {
    expect(doubleReward(100, 'red', 'red')).toBe(200)
    expect(doubleReward(100, 'black', 'black')).toBe(200)
    expect(doubleReward(100, 'green', 'green')).toBe(1400)
    expect(doubleReward(100, 'red', 'black')).toBe(0)
  })
  it('случайный слот в пределах барабана', () => {
    expect(randomDoubleSlot(0)).toBe(0)
    expect(randomDoubleSlot(0.99999)).toBe(37)
  })
})

import { crashMultiplierForFlight } from './chickenFlight'

describe('chicken flight instant crash', () => {
  it('каждый 5-й полёт с шансом 30% — краш на 1.00x', () => {
    expect(crashMultiplierForFlight(5, () => 0.5, () => 0.1)).toBe(1)
    expect(crashMultiplierForFlight(10, () => 0.5, () => 0.29)).toBe(1)
    expect(crashMultiplierForFlight(5, () => 0.5, () => 0.5)).toBeGreaterThan(1)
    expect(crashMultiplierForFlight(4, () => 0.5, () => 0.0)).toBeGreaterThan(1)
  })
})
