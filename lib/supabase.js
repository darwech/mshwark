import { createClient } from "@supabase/supabase-js";

/**
 * تهيئة كسولة (Lazy) لعميل Supabase:
 * العميل بيتعمل أول مرة يُستخدم فعليًا وقت التشغيل، مش وقت الـ import.
 *
 * ملحوظة مهمة: بنستخدم localStorage لحفظ الجلسة (مش Cookies) لأن التطبيق
 * كامله client-side (مفيش صفحات سيرفر بتحتاج تقرأ الجلسة)، و localStorage
 * أكتر استقرارًا جوه WebView بتاع تطبيق الأندرويد (APK) من الـ Cookies،
 * اللي كانت بتسبب أحيانًا: تسجيل خروج تلقائي، أو ظهور حساب غلط بعد
 * إعادة فتح التطبيق.
 */
let client = null;

function getClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
          storageKey: "mshwark-auth",
        },
      }
    );
  }
  return client;
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = getClient()[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
