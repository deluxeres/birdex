// Проверка Telegram initData (официальный алгоритм):
// secret = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)
// hash   = hex(HMAC_SHA256(key=secret, msg=data_check_string))
// data_check_string — все поля кроме hash, отсортированы, "key=value" через \n.

export interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

export interface TgAuth {
  user: TgUser
  startParam: string | null
}

const enc = new TextEncoder()
/** initData старше этого считается просроченной (сутки). */
const MAX_AGE_SEC = 24 * 60 * 60

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(msg))
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Сравнение без утечки по времени. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyInitData(initData: string, botToken: string): Promise<TgAuth | null> {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = await hmac(enc.encode('WebAppData'), botToken)
  const expected = toHex(await hmac(secret, check))
  if (!safeEqual(expected, hash)) return null

  const authDate = Number(params.get('auth_date') ?? 0)
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TgUser | null
    if (!user || typeof user.id !== 'number') return null
    return { user, startParam: params.get('start_param') }
  } catch {
    return null
  }
}
