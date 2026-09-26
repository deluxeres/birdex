// Единый список ассетов. Кладёшь файл в public/assets/... — прописываешь путь тут.
// Пока файла нет, компоненты показывают emoji-заглушку.

export const ASSETS = {
  farm: {
    barn: '/assets/farm/barn.png',
  },
  /** Картинки режимов в меню Play. */
  modes: {
    catch: '/assets/play/eggplay.webp',
    fox: '/assets/play/play2.webp',
    run: '/assets/play/play3.webp',
    double: '/assets/play/play4.webp',
  },
  /** Лисы в режиме "Защита от лис": обычная и крепкая (в каске). Смотрят вправо. */
  /** Яйцо в корзине — в центре "Защиты от лис". */
  eggBasket: '/assets/play/eggplay.webp',
  /** Барабан Дабла (из play/double.png): крутящаяся часть и неподвижная рамка с указателем. */
  double: { rotor: '/assets/play/double_rotor.webp', frame: '/assets/play/double_frame.webp' },
  /** Фоны Chicken Flight — при входе выбирается случайный. */
  crashBackgrounds: ['/assets/play/crash1.webp', '/assets/play/crash2.webp', '/assets/play/crash3.webp'],
  /** Бомба в режиме "Курица и бомбы". */
  bomb: '/assets/play/bomb.webp',
  foxes: {
    normal: '/assets/play/fox.webp',
    boss: '/assets/play/foxboss.webp',
  },
  /** Фон вкладки Play. Пока не используется — Play берёт выбранный фон фермы. */
  playBackground: '/assets/play/play_bg.webp',
  eggs: {
    /** Главная картинка яйца — используется везде (Play, шапка, склад, карточки). */
    normal: '/assets/eggs/egg.webp',
    /** Золотое яйцо в Play. Нет файла — берётся обычное с золотым оттенком. */
    golden: '/assets/eggs/egg_golden.webp',
    /** Ледяное яйцо в Play. Нет файла — обычное яйцо с голубым оттенком. */
    ice: '/assets/eggs/egg_ice.webp',
    basket: '/assets/eggs/basket.png',
  },
  ui: {
    /** Плашка ежедневной награды в шапке (календарь + окошко таймера). */
    calendar: '/assets/ui/calendar.webp',
    /** Рамка окна ежедневной награды (ячейки уже нарисованы, текст кладётся поверх). */
    /** Иконка BIRD Points (вместо 💎). */
    birdPoints: '/assets/ui/birdpoints.webp',
    /** Нижняя панель фермы (сбор, склад, кнопки) — ui/farmui. */
    /** Значок заданий "Пригласи друзей" (Activity). */
    referral: '/assets/ui/referal.webp',
    /** Кнопка "Улучшить" у куриц (зелёная плашка) и стрелка на ней. */
    upgradeBtn: '/assets/ui/upgrade.webp',
    upgradeArrow: '/assets/ui/upgrade_arrow.webp',
    /** Подарок (вместо 🎁): 7-й день календаря, бонус-код. */
    present: '/assets/ui/present.webp',
    farmPanel: '/assets/ui/farmui.webp',
    calendarFrame: '/assets/ui/uicalendar2.webp',
    /** Плашки "Рейтинг" и "Друзья" в шапке. */
    rating: '/assets/ui/rating.webp',
    friends: '/assets/ui/friends.webp',
    /** Монета — везде в игре вместо 🪙. */
    coin: '/assets/ui/money.webp',
    /** Иконки нижнего меню. */
    farm: '/assets/ui/farm.webp',
    shop: '/assets/ui/shop.webp',
    egg: '/assets/ui/egg_icon.png',
    energy: '/assets/ui/energy.png',
  },
} as const

/**
 * Фоны фермы — листаются стрелками на главном экране.
 * Добавить фон = положить файл в public/assets/farm/backgrounds и дописать строку сюда.
 */
export const FARM_BACKGROUNDS: string[] = [
  '/assets/farm/backgrounds/bg_1.webp',
  '/assets/farm/backgrounds/bg_2.webp',
  '/assets/farm/backgrounds/bg_3.webp',
  '/assets/farm/backgrounds/bg_4.webp',
  '/assets/farm/backgrounds/bg_5.webp',
]

/** Звуки: public/audio/sfx/*.mp3 и public/audio/music/*.mp3 */
export const SOUNDS = {
  eggCatch: '/audio/sfx/egg_catch.mp3',
  eggGolden: '/audio/sfx/egg_golden.mp3',
  /** Кнопка "Собрать" на ферме. */
  collect: '/audio/sfx/collect.mp3',
  coins: '/audio/sfx/coins.mp3',
  sell: '/audio/sfx/sell.mp3',
  upgrade: '/audio/sfx/upgrade.mp3',
  /** Покупка курицы в магазине. */
  buy: '/audio/sfx/buy.mp3',
  reward: '/audio/sfx/reward.mp3',
  /** Старый звук тапа по курице (не используется). */
  cluck: '/audio/sfx/cluck.mp3',
  /** Тап по курице на ферме. */
  chickenFarm: '/audio/sfx/chickenfarm.mp3',
  /** Нажатие на вкладку нижнего меню и стрелки фона. */
  click: '/audio/sfx/click.mp3',
  /** Ошибка: не хватает монет и т.п. */
  error: '/audio/sfx/error.mp3',
  /** Поймал ледяное яйцо — заморозка. */
  ice: '/audio/sfx/ice.mp3',
  /** Яйцо пролетело мимо в Play. */
  miss: '/audio/sfx/miss.mp3',
  /** Открыть Рейтинг / Друзья. */
  openPanel: '/audio/sfx/open_panel.mp3',
  /** Открыть ежедневную награду (календарь). */
  openCalendar: '/audio/sfx/open_calendar.mp3',
  /** Шестерёнка — открыть настройки. */
  settings: '/audio/sfx/settings.mp3',
  /** Покупка улучшения энергии в Play. */
  buyEnergy: '/audio/sfx/buy_energy.mp3',
  /** Улучшение курицы во вкладке Курочки. */
  improve: '/audio/sfx/improve.mp3',
  /** Кнопка "Выбрать курицу" и выбор курицы во вкладке Курочки. */
  pickChicken: '/audio/sfx/pick_chicken.mp3',
  /** Нажал на курицу в "Курица и бомбы" — квохчет и роняет перья. */
  chickenRun: '/audio/sfx/chicken_run.mp3',
  /** Кнопка "Продать яйца" на Ферме. */
  sellUi: '/audio/sfx/sellui.mp3',
  /** Поставить курицу на главный экран (окно "Выбрать курицу" на Ферме). */
  chickenClick: '/audio/sfx/chikenclick.mp3',
  /** Стрелки листания: недели в календаре и фон фермы. */
  clickCalendar: '/audio/sfx/clickcalendar.mp3',
  /** Повышение уровня игрока. */
  lvlup: '/audio/sfx/lvlup.mp3',
} as const

export const MUSIC = {
  farm: '/audio/music/farm_theme.mp3',
  play: '/audio/music/play_theme.mp3',
} as const

export type SoundId = keyof typeof SOUNDS
export type MusicId = keyof typeof MUSIC
