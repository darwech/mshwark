import webpush from "web-push";
import admin from "./firebaseAdmin";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * يبعت إشعار لمستخدم واحد على كل قنواته المسجلة (متصفح + تطبيق الموبايل)
 * @param {*} supabaseAdmin عميل Supabase بصلاحيات السيرفر (service role)
 * @param {string} userId
 * @param {{title: string, body: string, url?: string}} payload
 * @returns {Promise<number>} عدد الإشعارات اللي وصلت بنجاح
 */
export async function sendPushToUser(supabaseAdmin, userId, { title, body, url = "/" }) {
  let sent = 0;

  /* ============ ١) المتصفح (Web Push) ============ */
  const { data: webSubs, error: webSubsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

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
  const { data: fcmRows, error: fcmError } = await supabaseAdmin
    .from("fcm_tokens")
    .select("*")
    .eq("user_id", userId);

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
