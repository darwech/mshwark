import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../../../../lib/sendPushToUser";

// بيبعت إشعار push للمندوب لما العميل يختار عرضه من بين عدة عروض
// (الاتجاه العميل -> المندوب في نظام order_offers / customer_accept_driver_offer)
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
    const { offerId } = body;

    if (!offerId) {
      return Response.json({ error: "بيانات ناقصة: offerId مطلوب" }, { status: 400 });
    }

    // 4) جلب العرض ومعرفة صاحبه (المندوب) والطلب المرتبط بيه
    const { data: offer, error: offerError } = await supabaseAdmin
      .from("order_offers")
      .select("id, order_id, driver_id, price")
      .eq("id", offerId)
      .maybeSingle();

    if (offerError || !offer) {
      return Response.json({ error: "العرض غير موجود" }, { status: 404 });
    }

    // 5) التأكد إن اللي بيبعت الإشعار هو فعلاً صاحب الطلب (العميل)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("customer_id")
      .eq("id", offer.order_id)
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

    // 6) إرسال الإشعار للمندوب صاحب العرض المقبول
    const sent = await sendPushToUser(supabaseAdmin, offer.driver_id, {
      title: "🎉 تم قبول عرضك",
      body: `العميل وافق على عرضك بسعر ${offer.price} جنيه، تقدر تبدأ التنفيذ.`,
      url: "/",
    });

    return Response.json({ success: true, sent });
  } catch (error) {
    console.error("PUSH ACCEPT OFFER API ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
