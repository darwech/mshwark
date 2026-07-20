import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../../../../lib/sendPushToUser";

export async function POST(request) {
  try {
    // 1) التأكد إن المستخدم مسجل دخول
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
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

    // 6) تجهيز محتوى الإشعار
    const title = isUpdate ? "🔔 تم تحديث عرض السعر" : "🔔 عرض سعر جديد على مشوارك";

    const message = isUpdate
      ? `المندوب غيّر السعر إلى ${price} جنيه`
      : `وصلك عرض سعر بقيمة ${price} جنيه، افتح مشوارك عشان تقبل أو ترفض`;

    // 7) إرسال على قناتين المتصفح والتطبيق
    const sent = await sendPushToUser(supabaseAdmin, order.customer_id, {
      title,
      body: message,
      url: "/",
    });

    return Response.json({ success: true, sent });
  } catch (error) {
    console.error("PUSH OFFER API ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
