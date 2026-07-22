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

  // بعت لكل قنوات المتصفح بالتوازي بدل ما ننتظر واحدة ورا التانية
  const webResults = await Promise.allSettled(
    (webSubs || []).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body, url })
      )
    )
  );

  const expiredSubIds = [];

  webResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      const error = result.reason;
      console.error("WEB PUSH SEND ERROR:", error.statusCode, error.body || error.message);

      // اشتراك منتهي أو غير صالح، نجمعه عشان نمسحه
      if (error.statusCode === 404 || error.statusCode === 410) {
        expiredSubIds.push(webSubs[i].id);
      }
    }
  });

  if (expiredSubIds.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredSubIds);
  }

  /* ============ ٢) تطبيق الموبايل (Firebase FCM) ============ */
  const { data: fcmRows, error: fcmError } = admin
    ? await supabaseAdmin.from("fcm_tokens").select("*").eq("user_id", userId)
    : { data: [], error: null };

  if (fcmError) {
    console.error("FCM TOKENS ERROR:", fcmError);
  }

  // بعت لكل توكنات الموبايل بالتوازي، مع أولوية عالية (high priority)
  // عشان نظام Android/iOS ميأخرش الإشعار وقت توفير الطاقة أو الخلفية
  const fcmResults = await Promise.allSettled(
    (fcmRows || []).map((row) =>
      admin.messaging().send({
        token: row.token,
        notification: { title, body },
        data: { url },
        android: { priority: "high" },
        apns: {
          headers: { "apns-priority": "10" },
          payload: { aps: { sound: "default" } },
        },
      })
    )
  );

  const staleTokenIds = [];

  fcmResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      const error = result.reason;
      console.error("FCM SEND ERROR:", error?.errorInfo?.code || error.message);

      // توكن ملغي أو التطبيق مش متثبت، نجمعه عشان نمسحه
      if (
        error?.errorInfo?.code === "messaging/registration-token-not-registered" ||
        error?.errorInfo?.code === "messaging/invalid-registration-token"
      ) {
        staleTokenIds.push(fcmRows[i].id);
      }
    }
  });

  if (staleTokenIds.length) {
    await supabaseAdmin.from("fcm_tokens").delete().in("id", staleTokenIds);
  }

  return sent;
}