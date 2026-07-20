import { createBrowserClient } from '@supabase/ssr'

/**
 * تهيئة كسولة (Lazy) لعميل Supabase:
 * العميل بيتعمل أول مرة يُستخدم فعليًا وقت التشغيل، مش وقت الـ import.
 * ده بيمنع فشل الـ Build/Prerender لو متغيرات البيئة مش متاحة وقت البناء،
 * ومن غير ما نغيّر طريقة الاستخدام في باقي الكود (supabase.from(...) إلخ).
 */
let client = null

function getClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return client
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = getClient()[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)
