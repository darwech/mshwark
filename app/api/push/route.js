import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    // 1) التأكد إن المستخدم مسجل دخول
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Supabase بصلاحيات المستخدم
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Supabase بصلاحيات السيرفر فقط
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // 2) التحقق من الـSession
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json(
        { error: "Invalid session" },
        { status: 401 }
      );
    }

    // 3) بيانات الإشعار
    const body = await request.json();

    const {
      title = "مشوارك 🔔",
      message = "يوجد طلب جديد متاح",
      url = "/",
    } = body;

    // 4) جلب المندوبين المتاحين
    const { data: drivers, error: driversError } =
      await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "driver")
        .eq("is_available", true);

    if (driversError) {
      console.error("DRIVERS ERROR:", driversError);

      return Response.json(
        { error: driversError.message },
        { status: 500 }
      );
    }

    const driverIds = (drivers || []).map(
      (driver) => driver.id
    );

    console.log("PUSH DRIVERS:", drivers);
    console.log("PUSH DRIVER IDS:", driverIds);

    if (driverIds.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        driversFound: 0,
        subscriptionsFound: 0,
        message: "No available drivers",
      });
    }

    // 5) جلب Push Subscriptions الخاصة بالمندوبين
    const {
      data: subscriptions,
      error: subscriptionsError,
    } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", driverIds);

    console.log(
      "PUSH SUBSCRIPTIONS:",
      subscriptions
    );

    if (subscriptionsError) {
      console.error(
        "SUBSCRIPTIONS ERROR:",
        subscriptionsError
      );

      return Response.json(
        { error: subscriptionsError.message },
        { status: 500 }
      );
    }

    // 6) تجهيز محتوى الإشعار
    const notificationPayload = JSON.stringify({
      title,
      body: message,
      url,
    });

    let sent = 0;

    // 7) إرسال الإشعار لكل جهاز مسجل
    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );

        sent++;
      } catch (error) {
        console.error(
          "PUSH SEND ERROR:",
          error.statusCode,
          error.body || error.message
        );

        // حذف الاشتراكات المنتهية
        if (
          error.statusCode === 404 ||
          error.statusCode === 410
        ) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      }
    }

    // 8) النتيجة
    return Response.json({
      success: true,
      sent,
      driversFound: drivers?.length || 0,
      subscriptionsFound:
        subscriptions?.length || 0,
    });
  } catch (error) {
    console.error("PUSH API ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}