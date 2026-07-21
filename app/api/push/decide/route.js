import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../../../../lib/sendPushToUser";

// بيبعت إشعار push للمندوب لما العميل يقبل أو يرفض سعر المشوار
// (الاتجاه العميل -> المندوب في نظام العرض الواحد / customer_decide_offer)
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
    const { orderId, accepted } = body;

    if (!orderId || typeof accepted !== "boolean") {
      return Response.json(
        { error: "بيانات ناقصة: orderId و accepted مطلوبين" },
        { status: 400 }
      );
    }

    // 4) جلب الطلب والتأكد إن اللي بيبعت الإشعار هو فعلاً صاحب الطلب (العميل)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("customer_id, driver_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    if (order.customer_id !== user.id) {
      return Response.json(
        { error: "غير مصرح لك بإرسال إشعار على هذا الطلب" },
        { status: 403 }
      );
    }

    if (!order.driver_id) {
      return Response.json({ success: true, sent: 0, message: "No driver on order" });
    }

    // 5) تجهيز محتوى الإشعار
    const title = accepted ? "🎉 تم قبول عرضك" : "❌ تم رفض عرضك";
    const message = accepted
      ? "العميل وافق على سعر المشوار، تقدر تبدأ التنفيذ."
      : "العميل رفض سعر المشوار اللي بعتهولُه.";

    // 6) إرسال على قناتي المتصفح والتطبيق
    const sent = await sendPushToUser(supabaseAdmin, order.driver_id, {
      title,
      body: message,
      url: "/",
    });

    return Response.json({ success: true, sent });
  } catch (error) {
    console.error("PUSH DECIDE API ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
