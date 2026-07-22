import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../../../lib/sendPushToUser";

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

    // 3) بيانات الإشعار
    const body = await request.json();

    const {
      title = "مشوارك 🔔",
      message = "يوجد طلب جديد متاح",
      url = "/",
      serviceType = null,
    } = body;

    // 4) جلب المندوبين المتاحين واللي بيقدروا يخدموا نوع الطلب ده
    let driversQuery = supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "driver")
      .eq("is_available", true);

    if (serviceType === "purchase") {
      driversQuery = driversQuery.not("can_purchase", "is", false);
    } else if (serviceType === "delivery") {
      driversQuery = driversQuery.not("can_delivery", "is", false);
    } else if (serviceType === "ride") {
      driversQuery = driversQuery.not("can_ride", "is", false);
    }

    const { data: drivers, error: driversError } = await driversQuery;

    if (driversError) {
      console.error("DRIVERS ERROR:", driversError);
      return Response.json({ error: driversError.message }, { status: 500 });
    }

    const driverIds = (drivers || []).map((driver) => driver.id);

    if (driverIds.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        driversFound: 0,
        message: "No available drivers",
      });
    }

    // 5) إرسال لكل مندوب على قناتيه (متصفح + تطبيق موبايل) بالتوازي
    //    بدل التتابع، عشان أول مندوب وآخر واحد ياخدوا الإشعار في نفس اللحظة تقريبًا
    const results = await Promise.all(
      driverIds.map((driverId) =>
        sendPushToUser(supabaseAdmin, driverId, {
          title,
          body: message,
          url,
        })
      )
    );

    const sent = results.reduce((total, count) => total + count, 0);

    return Response.json({
      success: true,
      sent,
      driversFound: drivers?.length || 0,
    });
  } catch (error) {
    console.error("PUSH API ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}