// Донатные курицы: покупаются за Telegram Stars или TON (не за монеты).
// Пока у всех картинка Лунной курицы, перекрашенная в свой цвет (chickens/donate_1..7.webp) — потом заменим на свои.
// ⚠️ Цены и доход — черновые, поменяй под себя. Оплата пока не подключена (кнопки показывают "скоро").

export interface DonateChicken {
  key: string
  name: string
  /** Яиц в час на 1 уровне. */
  eggsPerHour: number
  /** Цена в Telegram Stars (⭐). */
  stars: number
  /** Цена в TON. */
  ton: number
  /** Картинка курицы. */
  asset: string
  /** Цвет рамки карточки. */
  color: string
}

export const DONATE_CHICKENS: DonateChicken[] = [
  { key: 'donate_1', asset: '/assets/chickens/donate_1.webp', name: 'Лунная Изумрудная', eggsPerHour: 15_000, stars: 50, ton: 0.25, color: '#3ccf5a' },
  { key: 'donate_2', asset: '/assets/chickens/donate_2.webp', name: 'Лунная Сапфировая', eggsPerHour: 25_000, stars: 100, ton: 0.5, color: '#3aa0ff' },
  { key: 'donate_3', asset: '/assets/chickens/donate_3.webp', name: 'Лунная Аметистовая', eggsPerHour: 40_000, stars: 250, ton: 1.2, color: '#b05bff' },
  { key: 'donate_4', asset: '/assets/chickens/donate_4.webp', name: 'Лунная Рубиновая', eggsPerHour: 60_000, stars: 500, ton: 2.5, color: '#ff4d6d' },
  { key: 'donate_5', asset: '/assets/chickens/donate_5.webp', name: 'Лунная Розовая', eggsPerHour: 90_000, stars: 1_000, ton: 5, color: '#ff8ad8' },
  { key: 'donate_6', asset: '/assets/chickens/donate_6.webp', name: 'Лунная Золотая', eggsPerHour: 130_000, stars: 2_500, ton: 12, color: '#f5b82e' },
  { key: 'donate_7', asset: '/assets/chickens/donate_7.webp', name: 'Лунная Обсидиановая', eggsPerHour: 200_000, stars: 5_000, ton: 25, color: '#9aa0b5' },
]
