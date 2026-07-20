import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    // 1) التأكد من تسجيل الدخول
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

    // 2) معرفة المستخدم الحقيقي من الـ Token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    // 3) استقبال توكن FCM من تطبيق الموبايل
    const { token: fcmToken } = await request.json();

    if (!fcmToken) {
      return Response.json({ error: "توكن الإشعارات غير موجود" }, { status: 400 });
    }

    // 4) حفظه (نفس التوكن ممكن ينتقل من حساب لحساب على نفس الجهاز)
    const { error: saveError } = await supabaseAdmin
      .from("fcm_tokens")
      .upsert(
        { user_id: user.id, token: fcmToken },
        { onConflict: "token" }
      );

    if (saveError) {
      console.error("FCM SAVE ERROR:", saveError);
      return Response.json({ error: saveError.message }, { status: 500 });
    }

    return Response.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("FCM SUBSCRIBE API ERROR:", error);
    return Response.json(
      { error: error?.message || "حدث خطأ أثناء تسجيل إشعارات الموبايل" },
      { status: 500 }
    );
  }
}
