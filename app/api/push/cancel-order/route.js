import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../../../../lib/sendPushToUser";

// بيبعت إشعار push للطرف التاني (عميل أو مندوب) لما حد يلغي الطلب
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
    const { orderId, reason } = body;

    if (!orderId) {
      return Response.json({ error: "orderId مطلوب" }, { status: 400 });
    }

    // 4) جلب الطلب والتأكد إن اللي بيبعت الإشعار طرف فيه فعلاً
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("customer_id, driver_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    const isCustomer = order.customer_id === user.id;
    const isDriver = order.driver_id === user.id;

    if (!isCustomer && !isDriver) {
      return Response.json(
        { error: "غير مصرح لك بإرسال إشعار على هذا الطلب" },
        { status: 403 }
      );
    }

    const otherUserId = isCustomer ? order.driver_id : order.customer_id;

    if (!otherUserId) {
      return Response.json({ success: true, sent: 0, message: "No other party on order" });
    }

    // 5) تجهيز محتوى الإشعار
    const title = "❌ تم إلغاء الطلب";
    const message = isCustomer
      ? `قام العميل بإلغاء الطلب.${reason ? " السبب: " + reason : ""}`
      : `قام المندوب بإلغاء الطلب.${reason ? " السبب: " + reason : ""}`;

    // 6) إرسال على قناتي المتصفح والتطبيق
    const sent = await sendPushToUser(supabaseAdmin, otherUserId, {
      title,
      body: message,
      url: "/",
    });

    return Response.json({ success: true, sent });
  } catch (error) {
    console.error("PUSH CANCEL ORDER API ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
