import { createClient } from "@supabase/supabase-js";

// بيتنفذ لحظة ما أي مستخدم (مندوب أو عميل) يعمل تسجيل خروج.
// الهدف: منع وصول إشعارات لحساب مسجل خروج فعليًا، عن طريق:
// 1) تحويل is_available لـ false (عشان broadcast الطلبات الجديدة يستبعده فورًا)
// 2) مسح توكنات الإشعارات بتاعته (موبايل + متصفح) عشان محدش يحاول يبعتله حاجة
//    وهو مسجل خروج، فمتتراكمش عنده وتوصله كلها دفعة واحدة لما يرجع يسجل دخول.
//
// ملحوظة: نفس منطق is_available وتسجيل الدخول/الخروج الأساسي (auth.signOut)
// لم يتغيّر، ده بس تنظيف إضافي بيتنفذ قبل الخروج.
export async function POST(request) {
  try {
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    // الثلاثة تنظيفات بالتوازي — كل واحد مستقل عن التاني
    const [profileResult, fcmResult, webPushResult] = await Promise.allSettled([
      supabaseAdmin
        .from("profiles")
        .update({ is_available: false })
        .eq("id", user.id),
      supabaseAdmin.from("fcm_tokens").delete().eq("user_id", user.id),
      supabaseAdmin.from("push_subscriptions").delete().eq("user_id", user.id),
    ]);

    if (profileResult.status === "rejected") {
      console.error("LOGOUT CLEANUP - PROFILE ERROR:", profileResult.reason);
    }
    if (fcmResult.status === "rejected") {
      console.error("LOGOUT CLEANUP - FCM ERROR:", fcmResult.reason);
    }
    if (webPushResult.status === "rejected") {
      console.error("LOGOUT CLEANUP - WEB PUSH ERROR:", webPushResult.reason);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("LOGOUT CLEANUP API ERROR:", error);
    // مهم: منرجعش خطأ يوقف عملية تسجيل الخروج نفسها، التنظيف ده تحسين
    // إضافي بس، مش شرط أساسي لإتمام الخروج
    return Response.json({ success: false, error: error.message }, { status: 200 });
  }
}