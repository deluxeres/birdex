// Локальное сохранение на устройстве. В Telegram главная копия — на сервере (services/cloud).
// Ключ свой для каждого Telegram-аккаунта, чтобы прогрессы не смешивались на одном телефоне.

const BASE_KEY = 'birdex_save_v1'
let key = BASE_KEY

export function setSaveOwner(userId: string | null): void {
  key = userId ? `${BASE_KEY}_${userId}` : BASE_KEY
}

export function loadSave<T>(): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeSave<T>(data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* приватный режим / нет места — игнорируем */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
