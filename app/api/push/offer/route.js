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
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

    // 2) التحقق من الـ Session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    // 3) بيانات الطلب
    const body = await request.json();
    const { orderId, price, isUpdate } = body;

    if (!orderId || !price) {
      return Response.json(
        { error: "بيانات ناقصة: orderId و price مطلوبين" },
        { status: 400 }
      );
    }

    // 4) تأكيد إن اللي بيبعت الإشعار هو فعلاً المندوب صاحب العرض على الطلب ده
    //    (يمنع أي مستخدم من إرسال إشعارات مزيفة لعميل تاني)
    const { data: offerRow, error: offerError } = await supabaseAdmin
      .from("order_offers")
      .select("id")
      .eq("order_id", orderId)
      .eq("driver_id", user.id)
      .maybeSingle();

    if (offerError) {
      console.error("OFFER LOOKUP ERROR:", offerError);
      return Response.json({ error: offerError.message }, { status: 500 });
    }

    if (!offerRow) {
      return Response.json(
        { error: "غير مصرح لك بإرسال إشعار على هذا الطلب" },
        { status: 403 }
      );
    }

    // 5) جلب صاحب الطلب (العميل)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("customer_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order?.customer_id) {
      return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    // 6) جلب اشتراكات الإشعارات الخاصة بالعميل
    const { data: subscriptions, error: subscriptionsError } =
      await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", order.customer_id);

    if (subscriptionsError) {
      console.error("SUBSCRIPTIONS ERROR:", subscriptionsError);
      return Response.json(
        { error: subscriptionsError.message },
        { status: 500 }
      );
    }

    if (!subscriptions?.length) {
      return Response.json({
        success: true,
        sent: 0,
        message: "العميل لسه ما فعّلش الإشعارات",
      });
    }

    // 7) تجهيز محتوى الإشعار
    const title = isUpdate
      ? "🔔 تم تحديث عرض السعر"
      : "🔔 عرض سعر جديد على مشوارك";

    const message = isUpdate
      ? `المندوب غيّر السعر إلى ${price} جنيه`
      : `وصلك عرض سعر بقيمة ${price} جنيه، افتح مشوارك عشان تقبل أو ترفض`;

    const notificationPayload = JSON.stringify({
      title,
      body: message,
      url: "/",
    });

    // 8) إرسال الإشعار
    let sent = 0;

    for (const sub of subscriptions) {
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
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      }
    }

    // 9) النتيجة
    return Response.json({
      success: true,
      sent,
      subscriptionsFound: subscriptions.length,
    });
  } catch (error) {
    console.error("PUSH OFFER API ERROR:", error);

    return Response.json({ error: error.message }, { status: 500 });
  }
}
