// Тонкая обёртка над Telegram WebApp. Работает и в обычном браузере (всё опционально).

interface TgUser { id: number; first_name: string; username?: string; photo_url?: string }

interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: TgUser; start_param?: string }
  ready(): void
  expand(): void
  setHeaderColor?(color: string): void
  setBackgroundColor?(color: string): void
  disableVerticalSwipes?(): void
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  openTelegramLink?(url: string): void
}

declare global {
  interface Window { Telegram?: { WebApp?: TgWebApp } }
}

export function tg(): TgWebApp | null {
  return window.Telegram?.WebApp ?? null
}

export function initTelegram(): void {
  const app = tg()
  if (!app) return
  app.ready()
  app.expand()
  app.setHeaderColor?.('#1b130d')
  app.setBackgroundColor?.('#1b130d')
  app.disableVerticalSwipes?.()
}

/** ⚠️ Только для отображения! Доверять можно лишь initData, проверенной на сервере. */
export function getTelegramUser(): TgUser | null {
  return tg()?.initDataUnsafe.user ?? null
}

export function getInitData(): string {
  return tg()?.initData ?? ''
}

/** Параметр из ссылки t.me/бот/app?startapp=... (например ref_123). */
export function getStartParam(): string | null {
  return tg()?.initDataUnsafe.start_param ?? null
}

export function shareInviteLink(link: string, text: string): void {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
  const app = tg()
  if (app?.openTelegramLink) app.openTelegramLink(url)
  else window.open(url, '_blank')
}
