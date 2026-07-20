import webpush from "web-push";
import { getFirebaseAdmin } from "./firebaseAdmin";

// تهيئة كسولة (Lazy) لمفاتيح VAPID: بتحصل أول استخدام وقت التشغيل مش وقت الـ import
let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID environment variables are not set");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * يبعت إشعار لمستخدم واحد على كل قنواته المسجلة (متصفح + تطبيق الموبايل)
 * @param {*} supabaseAdmin عميل Supabase بصلاحيات السيرفر (service role)
 * @param {string} userId
 * @param {{title: string, body: string, url?: string}} payload
 * @returns {Promise<number>} عدد الإشعارات اللي وصلت بنجاح
 */
export async function sendPushToUser(supabaseAdmin, userId, { title, body, url = "/" }) {
  let sent = 0;

  // لو قناة منهم مش متظبطة (متغيرات بيئة ناقصة)، التانية بتكمل شغل عادي
  let webPushReady = false;
  try {
    ensureVapidConfigured();
    webPushReady = true;
  } catch (error) {
    console.error("WEB PUSH CONFIG ERROR:", error.message);
  }

  let admin = null;
  try {
    admin = getFirebaseAdmin();
  } catch (error) {
    console.error("FIREBASE CONFIG ERROR:", error.message);
  }

  /* ============ ١) المتصفح (Web Push) ============ */
  const { data: webSubs, error: webSubsError } = webPushReady
    ? await supabaseAdmin.from("push_subscriptions").select("*").eq("user_id", userId)
    : { data: [], error: null };

  if (webSubsError) {
    console.error("WEB PUSH SUBS ERROR:", webSubsError);
  }

  for (const sub of webSubs || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body, url })
      );
      sent++;
    } catch (error) {
      console.error("WEB PUSH SEND ERROR:", error.statusCode, error.body || error.message);

      // اشتراك منتهي أو غير صالح، نمسحه
      if (error.statusCode === 404 || error.statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  /* ============ ٢) تطبيق الموبايل (Firebase FCM) ============ */
  const { data: fcmRows, error: fcmError } = admin
    ? await supabaseAdmin.from("fcm_tokens").select("*").eq("user_id", userId)
    : { data: [], error: null };

  if (fcmError) {
    console.error("FCM TOKENS ERROR:", fcmError);
  }

  for (const row of fcmRows || []) {
    try {
      await admin.messaging().send({
        token: row.token,
        notification: { title, body },
        data: { url },
      });
      sent++;
    } catch (error) {
      console.error("FCM SEND ERROR:", error?.errorInfo?.code || error.message);

      // توكن ملغي أو التطبيق مش متثبت، نمسحه
      if (
        error?.errorInfo?.code === "messaging/registration-token-not-registered" ||
        error?.errorInfo?.code === "messaging/invalid-registration-token"
      ) {
        await supabaseAdmin.from("fcm_tokens").delete().eq("id", row.id);
      }
    }
  }

  return sent;
}
