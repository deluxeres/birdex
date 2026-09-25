import type { ChickenDefinition, Rarity } from '@/types/game'
import { ECONOMY } from './economy'

/**
 * 36 куриц = 4 страницы по 9 во вкладке "Курочки".
 * Столбцы: номер, ключ, имя, редкость, яиц/час на 1 уровне, цена в монетах.
 * Картинка: public/assets/chickens/<ключ>.webp. Нет картинки — показывается
 * обычная курица, перекрашенная в свой оттенок (tint, градусы), как заглушка.
 *
 * Правила (см. ECONOMY):
 *  - доход растёт на +20% за уровень, максимум 15 уровень;
 *  - цена улучшения = доход/час × {ECONOMY.upgradeCostPerEggHour} × 1.37^(уровень-1)
 *    (первое улучшение окупается ~12 ч, последнее ~67 ч);
 *  - цена курицы окупается от ~5 ч (Рыжая) до ~150 ч (Алмазная/Золотая до 2–3 недель — финал).
 */
function hen(
  n: number, key: string, name: string, rarity: Rarity,
  eggsPerHour: number, price: number, tint = 0,
): ChickenDefinition {
  return {
    n, key, name, rarity, price, tint,
    baseProductionPerHour: eggsPerHour,
    baseUpgradeCost: Math.round(eggsPerHour * ECONOMY.upgradeCostPerEggHour),
    maxLevel: ECONOMY.chickenMaxLevel,
    asset: `/assets/chickens/${key}.webp`,
  }
}

export const CHICKENS: ChickenDefinition[] = [
  hen( 1, 'farm_hen', 'Обычная', 'common', 30, 0),
  hen( 2, 'red_hen', 'Рыжая', 'common', 70, 1800),
  hen( 3, 'speckled_hen', 'Пятнистая', 'common', 100, 2800),
  hen( 4, 'black_hen', 'Чёрная', 'common', 150, 4600),
  hen( 5, 'farmer_hen', 'Фермерская', 'common', 320, 11_000),
  hen( 6, 'hen_06', 'Пёстрая', 'common', 390, 15_000, 282),
  hen( 7, 'hen_07', 'Хохлатка', 'common', 480, 20_000, 329),
  hen( 8, 'hen_08', 'Несушка', 'common', 590, 27_000, 16),
  hen( 9, 'hen_09', 'Рябая', 'uncommon', 720, 36_000, 63),
  hen(10, 'hen_10', 'Белоснежка', 'uncommon', 880, 49_000, 110),
  hen(11, 'hen_11', 'Кудряшка', 'uncommon', 1_100, 68_000, 157),
  hen(12, 'hen_12', 'Шоколадная', 'uncommon', 1_300, 88_000, 204),
  hen(13, 'hen_13', 'Полосатая', 'uncommon', 1_600, 120_000, 251),
  hen(14, 'hen_14', 'Мохноногая', 'uncommon', 2_000, 170_000, 298),
  hen(15, 'hen_15', 'Бентамка', 'uncommon', 2_400, 220_000, 345),
  hen(16, 'hen_16', 'Шёлковая', 'uncommon', 2_900, 290_000, 32),
  hen(17, 'hen_17', 'Орловская', 'rare', 3_500, 390_000, 79),
  hen(18, 'hen_18', 'Павловская', 'rare', 4_300, 530_000, 126),
  hen(19, 'hen_19', 'Лесная', 'rare', 5_200, 710_000, 173),
  hen(20, 'hen_20', 'Болотная', 'rare', 6_300, 950_000, 220),
  hen(21, 'hen_21', 'Горная', 'rare', 7_700, 1_300_000, 267),
  hen(22, 'hen_22', 'Степная', 'rare', 9_400, 1_700_000, 314),
  hen(23, 'hen_23', 'Морская', 'rare', 11_000, 2_200_000, 1),
  hen(24, 'hen_24', 'Снежная', 'rare', 13_000, 2_900_000, 48),
  hen(25, 'hen_25', 'Огненная', 'epic', 16_000, 4_000_000, 95),
  hen(26, 'hen_26', 'Грозовая', 'epic', 20_000, 5_500_000, 142),
  hen(27, 'hen_27', 'Лунная', 'epic', 24_000, 7_300_000, 189),
  hen(28, 'hen_28', 'Солнечная', 'epic', 29_000, 9_700_000, 236),
  hen(29, 'hen_29', 'Звёздная', 'epic', 35_000, 13_000_000, 283),
  hen(30, 'hen_30', 'Королевская', 'epic', 43_000, 18_000_000, 330),
  hen(31, 'hen_31', 'Рыцарская', 'epic', 52_000, 24_000_000, 17),
  hen(32, 'hen_32', 'Самурайская', 'legendary', 63_000, 100_000_000, 64),
  hen(33, 'hen_33', 'Космическая', 'legendary', 77_000, 150_000_000, 111),
  hen(34, 'hen_34', 'Радужная', 'legendary', 94_000, 220_000_000, 158),
  hen(35, 'hen_35', 'Алмазная', 'legendary', 110_000, 300_000_000, 205),
  hen(36, 'golden_hen', 'Золотая', 'legendary', 130_000, 350_000_000),
]

export const STARTER_CHICKEN_KEY = 'farm_hen'
/** Картинка-заглушка для куриц без своего арта. */
export const PLACEHOLDER_CHICKEN_ASSET = '/assets/chickens/farm_hen.webp'
export const CHICKENS_PER_PAGE = 9

export function getChickenDef(key: string): ChickenDefinition {
  const def = CHICKENS.find((c) => c.key === key)
  if (!def) throw new Error(`Unknown chicken: ${key}`)
  return def
}

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
