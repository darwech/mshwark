import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    // 1) التأكد من تسجيل الدخول
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // 2) عميل عادي للتحقق من صاحب الحساب
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

    // 3) Admin للحفظ وتحديث الاشتراك بأمان
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

    // 4) معرفة المستخدم الحقيقي من الـ Token
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

    // 5) استقبال بيانات الجهاز
    const { endpoint, p256dh, auth } =
      await request.json();

    if (!endpoint || !p256dh || !auth) {
      return Response.json(
        { error: "بيانات الاشتراك غير مكتملة" },
        { status: 400 }
      );
    }

    // 6) نفس الجهاز ممكن ينتقل من عميل لمندوب والعكس
    // endpoint يحدد الجهاز/اشتراك المتصفح
    const { error: saveError } =
      await supabaseAdmin
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
          },
          {
            onConflict: "endpoint",
          }
        );

    if (saveError) {
      console.error(
        "PUSH SUBSCRIPTION SAVE ERROR:",
        saveError
      );

      return Response.json(
        { error: saveError.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      userId: user.id,
    });
  } catch (error) {
    console.error(
      "PUSH SUBSCRIBE API ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء تسجيل الإشعارات",
      },
      { status: 500 }
    );
  }
}