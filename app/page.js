"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import AnimatedSplash from "./components/AnimatedSplash";
import { DialogProvider, useDialog } from "./components/AppDialog";
import {
  Home as HomeIcon,
  Bike,
  Package,
  User,
  LogOut,
  Bell,
  BellOff,
  Settings,
  ShieldCheck,
  Store,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Truck,
  AlertTriangle,
  FileText,
  Car,
  Star,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Flag,
  Wallet,
  MessageSquare,
  Loader2,
  Camera,
  Mail,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
} from "lucide-react";

const statusText = {
  requested: "بانتظار المندوب",
  offer_sent: "عرض سعر بانتظار رد العميل",
  offer_accepted: "تم قبول السعر",
  offer_rejected: "تم رفض العرض",

  shopping: "جاري شراء الطلب",
  purchased: "تم شراء الطلب",

  delivering: "جاري التوصيل",

  driver_on_way: "المندوب في الطريق إليك",
  driver_arrived: "وصل المندوب لنقطة الركوب",
  ride_started: "بدأت الرحلة",

  delivered: "تم بنجاح",
  cancelled: "ملغي",
};

const trustText = {
  new: "عميل جديد",
  normal: "عميل موثوق",
  trusted: "عميل موثوق جدًا",
};

const serviceInfo = {
  purchase: {
    title: "اشتريهولي",
    emoji: "🛍️",
    description: "خلي المندوب يشتري احتياجاتك ويوصلها لحد عندك.",
  },

  delivery: {
    title: "وصّلهولي",
    emoji: "📦",
    description: "ابعت طرد أو حاجة من مكان لمكان بسهولة.",
  },

  ride: {
    title: "توصيلة",
    emoji: "🚗",
    description: "اطلب توصيلة ليك من مكان لمكان.",
  },
};

// أنواع المركبات: القيمة (value) تتخزن في قاعدة البيانات بالإنجليزية،
// والتسمية (label) هي اللي تتعرض للمستخدم بالعربية. مركزينها هنا في
// مكان واحد عشان تتستخدم في شاشة تسجيل المندوب وشاشة إنشاء الطلب
// من غير تكرار أو اختلاف بين الاتنين.
const VEHICLE_TYPES = [
  { value: "motorcycle", label: "موتوسيكل", emoji: "🛵" },
  { value: "car", label: "سيارة", emoji: "🚗" },
  { value: "tricycle", label: "تروسيكل", emoji: "🛺" },
];

const vehicleTypeLabel = (value) =>
  VEHICLE_TYPES.find((v) => v.value === value)?.label || null;

const money = (value) => `${Number(value || 0).toLocaleString("ar-EG")} ج`;

// ضغط الصورة قبل الرفع (Canvas) — تصغير الأبعاد الكبيرة وتحويلها لـ JPEG بجودة
// عالية لتقليل الحجم بدون تأثير ملحوظ على الجودة. لو فشل الضغط لأي سبب، بنرجع
// الملف الأصلي زي ما هو عشان الرفع يكمل بشكل طبيعي.
const MAX_PURCHASE_IMAGES = 3;

function compressImageFile(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale) || img.width;
        const height = Math.round(img.height * scale) || img.height;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              resolve(file);
              return;
            }

            resolve(
              new File(
                [blob],
                (file.name || "image").replace(/\.\w+$/, "") + ".jpg",
                { type: "image/jpeg" },
              ),
            );
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}

// عرض الوقت النسبي لإنشاء الطلب فقط (تنسيق عرض بحت - بدون أي تعديل على البيانات
// أو مصدرها؛ o.created_at موجود بالفعل ضمن بيانات الطلب المجلوبة من Supabase)
const timeAgo = (dateString) => {
  if (!dateString) return "";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} ي`;
};

export default function Home() {
  return (
    <DialogProvider>
      <HomeInner />
    </DialogProvider>
  );
}

function HomeInner() {
  const dialog = useDialog();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [notice, setNotice] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("SERVICE WORKER NOT SUPPORTED");
      return;
    }

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        console.log("SERVICE WORKER REGISTERED:", registration.scope);
      } catch (error) {
        console.error("SERVICE WORKER ERROR:", error);
      }
    }

    registerServiceWorker();
  }, []);

  function flash(text) {
    setNotice(text);

    setTimeout(() => {
      setNotice("");
    }, 3500);
  }

  async function loadProfile(user) {
  const userId = user.id;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Profile load error:", error);
    return;
  }

  // نتأكد إن الحساب لم يتغير أثناء تحميل بيانات الـ profile
  const {
    data: { session: latestSession },
  } = await supabase.auth.getSession();

  if (!latestSession || latestSession.user.id !== userId) {
    return;
  }

  setProfile(data || null);
}

  async function refresh() {
    if (!session?.user) return;

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(currentProfile || null);

    let query = supabase.from("orders").select(`
        *,
        customer:profiles!orders_customer_id_fkey(
          id,
          full_name,
          avatar_url,
          trust_level,
          completed_orders,
          cancelled_orders,
          rating,
          rating_count,
          created_at
        ),
        driver:profiles!orders_driver_id_fkey(
          id,
          full_name,
          phone,
          vehicle_type,
          vehicle_plate,
          rating,
          rating_count
        )
      `);

    if (currentProfile?.role === "customer") {
      query = query.eq("customer_id", session.user.id);
    }

    if (currentProfile?.role === "driver") {
      // المندوب يشوف بس الطلبات المتاحة (requested + بدون مندوب) اللي نوع
      // مركبتها بيطابق نوع مركبته، بالإضافة لأي طلب اتخصص له هو بالفعل
      // (بغض النظر عن نوع المركبة، عشان طلباته الحالية/السابقة تفضل ظاهرة له)
      const driverVehicleType = currentProfile?.vehicle_type;

      query = driverVehicleType
        ? query.or(
            `and(status.eq.requested,driver_id.is.null,vehicle_type.eq.${driverVehicleType}),driver_id.eq.${session.user.id}`,
          )
        : query.or(
            `and(status.eq.requested,driver_id.is.null),driver_id.eq.${session.user.id}`,
          );
    }

    const { data: orderData, error: orderError } = await query.order(
      "created_at",
      {
        ascending: false,
      },
    );

    if (!orderError) {
      setOrders(orderData || []);
    }

    const { data: driverData } = await supabase
      .from("profiles")
      .select(
        `
  id,
  full_name,
  phone,
  vehicle_type,
  vehicle_plate,
  avatar_url,
  rating,
  rating_count,
  is_available,
  driver_status,
  can_purchase,
  can_delivery,
  can_ride
`,
      )
      .eq("role", "driver")
      .eq("driver_status", "approved")
      .eq("is_available", true);

    setDrivers(driverData || []);
  }

  useEffect(() => {
    let subscription;

    // أقل مدة تفضل فيها شاشة التحميل المتحركة ظاهرة (بالميلي ثانية)
    // بتغطي: رسم الشعار + ظهور الاسم حرف بحرف بالكامل + لحظة استقرار
    // قبل ما تختفي، حتى لو الـ session اتأكد منه بسرعة جدًا
    const MIN_SPLASH_MS = 2700;
    const splashStartedAt = Date.now();

    async function init() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (currentSession) {
        await loadProfile(currentSession.user);
      }

      const elapsed = Date.now() - splashStartedAt;
      const remaining = MIN_SPLASH_MS - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setLoading(false);

      const authListener = supabase.auth.onAuthStateChange(
        async (_, newSession) => {
          setSession(newSession);

          if (newSession) {
            await loadProfile(newSession.user);
          } else {
            setProfile(null);
          }
        },
      );

      subscription = authListener.data.subscription;
    }

    init();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      refresh();
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel("mshwark-v3-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);
  async function handleLogout() {
    // تنظيف قبل الخروج: نمنع وصول أي إشعارات للحساب ده وهو مسجل خروج
    // (تحويل is_available لـ false + مسح توكنات الإشعارات). بنستخدم
    // Bearer token الحالي هنا لأننا لسه في نفس اللحظة قبل إنهاء الجلسة.
    try {
      if (session?.access_token) {
        await fetch("/api/push/logout-cleanup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }
    } catch (cleanupError) {
      // حتى لو فشل التنظيف، تسجيل الخروج نفسه لازم يكمل عادي
      console.error("Logout cleanup error:", cleanupError);
    }

    setProfile(null);
    setSession(null);

    // scope: "local" — نلغي جلسة *هذا الجهاز* فقط. القيمة الافتراضية
    // كانت "global" (تلغي كل جلسات نفس الحساب على كل الأجهزة)، وده كان
    // سبب bug: لو نفس الحساب مفتوح على جهازين (مثلاً Laptop + Phone)،
    // تسجيل الخروج من جهاز واحد كان بيبطل الـ session بتاعة الجهاز التاني
    // عند GoTrue (حتى لو access token لسه صالح شكليًا)، فكانت طلبات مثل
    // /api/push (اللي بتعمل getUser() — تحقق حي من السيرفر) بترجع 401
    // وتفشل بصمت، رغم إن عمليات زي إنشاء الطلب (عبر PostgREST) كانت
    // بتنجح لأنها بتتحقق من الـ JWT محليًا فقط بدون تواصل مع GoTrue.
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      console.error("Logout error:", error);
    }
  }

  if (loading) {
    return <AnimatedSplash message="جاري تحميل مشوارك..." />;
  }

  if (!session) {
    return <Auth flash={flash} />;
  }

  if (!profile) {
    return <AnimatedSplash message="جاري تجهيز حسابك..." />;
  }

  if (profile.role === "admin") {
    return <Admin logout={handleLogout} flash={flash} />;
  }

  return (
    <div className="shell">
      <Header
        profile={profile}
        logout={handleLogout}
        openAccount={() => setShowAccount(true)}
      />
      {showAccount && (
        <div className="overlay" onClick={() => setShowAccount(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setShowAccount(false)}>
              ✕
            </button>

            <h2>حسابي</h2>

            <p>من هنا يمكنك إدارة حسابك وتغيير كلمة المرور.</p>
            <input
              type="password"
              placeholder="كلمة المرور الجديدة"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="تأكيد كلمة المرور الجديدة"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />

            <button
              className="primary"
              onClick={async () => {
                if (newPassword.length < 6) {
                  await dialog.alert("كلمة المرور لازم تكون 6 أحرف على الأقل");
                  return;
                }

                if (newPassword !== confirmNewPassword) {
                  await dialog.alert("كلمتا المرور غير متطابقتين");
                  return;
                }

                const { error } = await supabase.auth.updateUser({
                  password: newPassword,
                });

                if (error) {
                  await dialog.alert("حدث خطأ: " + error.message);
                  return;
                }

                await dialog.alert("تم تغيير كلمة المرور بنجاح ✅");

                setNewPassword("");
                setConfirmNewPassword("");
                setShowAccount(false);
              }}
            >
              تغيير كلمة المرور
            </button>
          </div>
        </div>
      )}

      {profile.role === "customer" ? (
        <Customer
          profile={profile}
          orders={orders}
          drivers={drivers}
          refresh={refresh}
          flash={flash}
          openAccount={() => setShowAccount(true)}
        />
      ) : (
        <Driver
          profile={profile}
          orders={orders}
          refresh={refresh}
          flash={flash}
          openAccount={() => setShowAccount(true)}
        />
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

/* =========================================
   AUTH
========================================= */

function Auth({ flash }) {
  const dialog = useDialog();
  const [mode, setMode] = useState("login");

  const [role, setRole] = useState("customer");

  const [vehicleType, setVehicleType] = useState(""); // نوع مركبة المندوب - إلزامي عند role === "driver"

  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false); // تحكم بصري فقط في إظهار/إخفاء كلمة المرور
  const heroMotionRef = useRef(null); // إشارة بصرية فقط لتوهيج نقطة الانطلاق في الرسمة عند التركيز على الحقول

  const [cardFront, setCardFront] = useState(null);

  const [cardBack, setCardBack] = useState(null);
  const [driverAvatar, setDriverAvatar] = useState(null);

  async function uploadDriverDocument(userId, file, side) {
    if (!file) {
      throw new Error("صورة البطاقة غير موجودة");
    }

    const extension = file.name?.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${userId}/${side}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("driver-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    return filePath;
  }
  async function uploadDriverAvatar(userId, file) {
    if (!file) {
      throw new Error("الصورة الشخصية غير موجودة");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("لازم تختار صورة صحيحة");
    }

    const extension = file.name.split(".").pop().toLowerCase() || "jpg";

    const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("driver-avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("driver-avatars")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function submit(e) {
    e.preventDefault();

    setBusy(true);

    try {
      const form = new FormData(e.currentTarget);

      const email = form.get("email");

      const password = form.get("password");

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message === "Invalid login credentials") {
            setAuthError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          } else if (error.message.includes("Email not confirmed")) {
            setAuthError("يرجى تأكيد البريد الإلكتروني أولاً");
          } else {
            setAuthError("حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى");
          }

          return;
        }

        setAuthError("");
        return;
      }

      if (role === "driver" && !vehicleType) {
        throw new Error("لازم تختار نوع مركبتك أولاً");
      }

      if (role === "driver" && (!driverAvatar || !cardFront || !cardBack)) {
        throw new Error(
          "لازم ترفع صورتك الشخصية وصورة البطاقة من الأمام والخلف",
        );
      }

      const metadata = {
        full_name: form.get("name"),

        phone: form.get("phone"),

        role,

        vehicle_type: role === "driver" ? vehicleType : null,

        vehicle_plate: role === "driver" ? form.get("vehiclePlate") : null,

        national_id: role === "driver" ? form.get("nationalId") : null,
      };

      const { data, error } = await supabase.auth.signUp({
        email,
        password,

        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      if (role === "driver" && data.user) {
        flash("جاري رفع مستندات التحقق...");
        const avatarUrl = await uploadDriverAvatar(data.user.id, driverAvatar);

        const frontPath = await uploadDriverDocument(
          data.user.id,
          cardFront,
          "front",
        );

        const backPath = await uploadDriverDocument(
          data.user.id,
          cardBack,
          "back",
        );

        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            avatar_url: avatarUrl,
            id_card_front: frontPath,

            id_card_back: backPath,

            vehicle_plate: form.get("vehiclePlate"),

            driver_status: "pending",

            can_purchase: true,
            can_delivery: true,
            can_ride: false,
          })
          .eq("id", data.user.id);

        if (profileError) {
          throw profileError;
        }

        flash("تم إنشاء الحساب وإرسال بياناتك للمراجعة");
      } else {
        flash("تم إنشاء حسابك في مشوارك بنجاح");
      }
    } catch (error) {
      console.error(error);

      flash(error.message || "حدث خطأ، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="authHero">
        <div className="heroMotion" aria-hidden="true" ref={heroMotionRef}>
          <svg className="routeSvg" viewBox="0 0 260 220">
            <path
              className="routePath"
              d="M18,190 C70,175 55,110 110,95 C160,82 165,40 235,22"
            />
          </svg>

          <span className="routePin routePinStart" />
          <span className="routePin routePinEnd" />

          <div className="routeRider">
            <Bike size={18} />
          </div>

          <div className="floatIcon floatIconBag">
            <ShoppingBag size={15} />
          </div>

          <div className="floatIcon floatIconBox">
            <Package size={14} />
          </div>
        </div>

        <div className="logo">
          مشوارك
          <span>●</span>
        </div>

        <h1>
          أي مشوار..
          <br />
          أسهل مع مشوارك.
        </h1>

        <p>اشتري احتياجاتك، ابعت حاجة، أو اطلب توصيلة من مكان لمكان.</p>
      </section>

      <form className="authCard" onSubmit={submit}>
        <div className={`seg seg2 ${mode === "register" ? "segIsRegister" : "segIsLogin"}`}>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            دخول
          </button>

          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            حساب جديد
          </button>
        </div>

        {mode === "register" && (
          <>
            <label>نوع الحساب</label>

            <div className="roles">
              <button
                type="button"
                className={role === "customer" ? "chosen" : ""}
                onClick={() => setRole("customer")}
              >
                <User />
                عميل
              </button>

              <button
                type="button"
                className={role === "driver" ? "chosen" : ""}
                onClick={() => setRole("driver")}
              >
                <Bike />
                مندوب
              </button>
            </div>

            <input name="name" required placeholder="الاسم بالكامل" />

            <input name="phone" required placeholder="رقم الموبايل" />

            {role === "driver" && (
              <>
                <label>نوع المركبة</label>

                <div className="roles vehicleTypeRoles">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      className={vehicleType === v.value ? "chosen" : ""}
                      onClick={() => setVehicleType(v.value)}
                    >
                      <span aria-hidden="true">{v.emoji}</span>
                      {v.label}
                    </button>
                  ))}
                </div>

                {!vehicleType && (
                  <small className="privacyNote">
                    من فضلك اختر نوع المركبة قبل إنشاء الحساب
                  </small>
                )}

                <input name="vehiclePlate" placeholder="رقم اللوحة - إن وجد" />

                <input
                  name="nationalId"
                  required
                  minLength={14}
                  maxLength={14}
                  placeholder="الرقم القومي"
                />

                <div className="verificationBox">
                  <ShieldCheck size={30} />

                  <div>
                    <b>توثيق هوية المندوب</b>

                    <p>يتم مراجعة بياناتك قبل تفعيل استقبال الطلبات.</p>
                  </div>
                </div>
                <label>الصورة الشخصية</label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) => setDriverAvatar(e.target.files?.[0] || null)}
                />

                <small className="privacyNote">
                  ارفع صورة شخصية واضحة لك، ستظهر للعميل للتعرف عليك.
                </small>

                <label>البطاقة — الوجه الأمامي</label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) => setCardFront(e.target.files?.[0] || null)}
                />

                <label>البطاقة — الوجه الخلفي</label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) => setCardBack(e.target.files?.[0] || null)}
                />

                <small className="privacyNote">
                  🔒 مستنداتك خاصة وتستخدمها الإدارة للتحقق فقط.
                </small>
              </>
            )}
          </>
        )}

        <div className="fieldIcon">
          <Mail size={18} />
          <input
            name="email"
            type="email"
            required
            placeholder="البريد الإلكتروني"
            onFocus={() => heroMotionRef.current?.classList.add("pinGlow")}
            onBlur={() => heroMotionRef.current?.classList.remove("pinGlow")}
            onInvalid={(e) => {
              const el = e.currentTarget;
              el.classList.remove("shakeField");
              // إعادة تشغيل الحركة حتى لو الكلاس كان متحطوط قبل كده
              void el.offsetWidth;
              el.classList.add("shakeField");
            }}
            onAnimationEnd={(e) => e.currentTarget.classList.remove("shakeField")}
          />
        </div>

        <div className="fieldIcon">
          <Lock size={18} />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={6}
            required
            placeholder="كلمة المرور"
            className="hasTrailingIcon"
            onFocus={() => heroMotionRef.current?.classList.add("pinGlow")}
            onBlur={() => heroMotionRef.current?.classList.remove("pinGlow")}
            onInvalid={(e) => {
              const el = e.currentTarget;
              el.classList.remove("shakeField");
              void el.offsetWidth;
              el.classList.add("shakeField");
            }}
            onAnimationEnd={(e) => e.currentTarget.classList.remove("shakeField")}
          />
          <button
            type="button"
            className="fieldTrailingButton"
            tabIndex={-1}
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {mode === "login" && authError && (
          <div className="authError authErrorEnter">{authError}</div>
        )}

        <button className="primary" disabled={busy}>
          {busy && <Loader2 className="spin" size={18} />}
          {busy
            ? "جاري التنفيذ..."
            : mode === "login"
              ? "تسجيل الدخول"
              : "إنشاء الحساب"}
        </button>
        {mode === "login" && (
          <button
            type="button"
            className="forgotPassword"
            onClick={async () => {
              const email = await dialog.prompt(
                "اكتب البريد الإلكتروني المسجل به حسابك:",
              );

              if (!email) return;

              const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim(),
                {
                  redirectTo: `${window.location.origin}/reset-password`,
                },
              );

              if (error) {
                await dialog.alert("حصل خطأ: " + error.message);
                return;
              }

              await dialog.alert(
                "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني ✅",
              );
            }}
          >
            <HelpCircle size={14} />
            نسيت كلمة المرور؟
          </button>
        )}
      </form>
    </main>
  );
}

/* =========================================
   HEADER
========================================= */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// ترحيب بسيط حسب وقت اليوم — نص عرض بس، من غير أي state أو تأثير على البيانات
function greetingWord() {
  const hour = new Date().getHours();
  if (hour < 12) return "صباح الخير";
  if (hour < 17) return "أهلاً";
  return "مساء الخير";
}

function Header({ profile, logout, openAccount }) {
  const dialog = useDialog();
  const [pushGranted, setPushGranted] = useState(false);

  // تسجيل توكن إشعارات الموبايل (FCM) أول ما يوصل من النظام
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !profile?.id) return;

    let registrationListener;
    let errorListener;

    async function setupFcmListeners() {
      registrationListener = await PushNotifications.addListener(
        "registration",
        async (tokenResult) => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) return;

            await fetch("/api/push/fcm-subscribe", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ token: tokenResult.value }),
            });

            console.log("FCM TOKEN SAVED");
          } catch (error) {
            console.error("FCM TOKEN SAVE ERROR:", error);
          }
        },
      );

      errorListener = await PushNotifications.addListener(
        "registrationError",
        (error) => {
          console.error("FCM REGISTRATION ERROR:", error);
        },
      );
    }

    setupFcmListeners();

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
    };
  }, [profile?.id]);

  // دالة موحّدة لتفعيل/تجديد اشتراك الإشعارات، تُستخدم في حالتين:
  // 1) لما المستخدم يدوس على الجرس بنفسه (silent=false: بتطلب الإذن وتظهر رسائل)
  // 2) تلقائيًا أول ما يفتح التطبيق لو الإذن ممنوح بالفعل (silent=true: من غير
  //    ما تطلب إذن جديد ومن غير ما تظهر أي Alert، عشان تشتغل في الخلفية بهدوء)
  async function activatePush({ silent } = { silent: false }) {
    try {
      if (!profile?.id) {
        if (!silent) await dialog.alert("يجب تسجيل الدخول أولًا");
        return;
      }

      // ============ داخل تطبيق الموبايل (APK) ============
      if (Capacitor.isNativePlatform()) {
        const currentPerm = await PushNotifications.checkPermissions();
        let finalPerm = currentPerm.receive;

        // في الوضع الصامت (silent) منطلبش إذن جديد، بس لو ممنوح بالفعل
        // بنجدد التسجيل عشان نضمن إن التوكن محفوظ ومحدث على السيرفر
        if (
          !silent &&
          (finalPerm === "prompt" || finalPerm === "prompt-with-rationale")
        ) {
          const requested = await PushNotifications.requestPermissions();
          finalPerm = requested.receive;
        }

        if (finalPerm !== "granted") {
          setPushGranted(false);
          if (!silent) {
            await dialog.alert("لازم تسمح بالإشعارات علشان توصلك تحديثات مشوارك");
          }
          return;
        }

        // ده بيشغل الـ listener اللي مسجل فوق في useEffect
        // وهو اللي بيحفظ التوكن على السيرفر أول ما يوصل
        await PushNotifications.register();

        setPushGranted(true);
        if (!silent) await dialog.alert("تم تفعيل إشعارات مشوارك بنجاح 🔔");
        return;
      }

      // ============ على المتصفح (الموقع العادي) ============

      // التأكد إن الجهاز يدعم Push Notifications
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        if (!silent) await dialog.alert("جهازك أو المتصفح لا يدعم إشعارات Push");
        return;
      }

      // في الوضع الصامت: لو الإذن مش ممنوح أصلاً منطلبوش (منعًا لظهور
      // نافذة الإذن من غير تفاعل مباشر من المستخدم)، وننتظر لحد ما يدوس الجرس
      if (silent && Notification.permission !== "granted") {
        setPushGranted(false);
        return;
      }

      // طلب إذن الإشعارات (لو ممنوح بالفعل، الدالة دي بترجع فورًا من غير أي نافذة)
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setPushGranted(false);
        if (!silent) {
          await dialog.alert("لازم تسمح بالإشعارات علشان توصلك تحديثات مشوارك");
        }
        return;
      }

      // انتظار Service Worker
      const registration = await navigator.serviceWorker.ready;

      // البحث عن اشتراك موجود على نفس الجهاز
      let subscription = await registration.pushManager.getSubscription();

      // إنشاء اشتراك لو مفيش
      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          throw new Error("VAPID Public Key غير موجود");
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,

          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();

      if (!subscription.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("بيانات Push Subscription غير مكتملة");
      }

      // نحصل على Session الحالية
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("جلسة تسجيل الدخول غير صالحة");
      }

      // إرسال الاشتراك للسيرفر (بيحدّث نفس الـ endpoint لو موجود بالفعل،
      // فمفيش خطورة إننا نكررها في كل مرة يفتح فيها التطبيق)
      const response = await fetch("/api/push/subscribe", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          endpoint: subscription.endpoint,

          p256dh: json.keys.p256dh,

          auth: json.keys.auth,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("PUSH SAVE ERROR:", result);

        throw new Error(result.error || "فشل حفظ اشتراك الإشعارات");
      }

      console.log("PUSH SUBSCRIPTION SAVED:", result);

      setPushGranted(true);
      if (!silent) await dialog.alert("تم تفعيل إشعارات مشوارك بنجاح 🔔");
    } catch (error) {
      console.error("PUSH SUBSCRIPTION ERROR:", error);

      if (!silent) {
        await dialog.alert("تعذر تفعيل الإشعارات: " + (error?.message || "خطأ غير معروف"));
      }
    }
  }

  // تفعيل تلقائي وصامت لما التطبيق يفتح: لو المستخدم سبق ووافق على
  // الإشعارات مرة، هيتم تجديد الاشتراك/التوكن من غير ما يحتاج يدوس
  // على الجرس تاني كل مرة
  useEffect(() => {
    if (!profile?.id) return;

    activatePush({ silent: true });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <header>
      <div className="logo">
        مشوارك
        <span>●</span>
      </div>

      <div className="headActions">
        <button
          className="icon"
          title={
            pushGranted ? "الإشعارات مفعّلة" : "تفعيل الإشعارات"
          }
          onClick={() => activatePush({ silent: false })}
        >
          {pushGranted ? <Bell size={19} /> : <BellOff size={19} />}
        </button>
        <div className="hello">{greetingWord()}، {profile.full_name?.split(" ")[0]}</div>

        <button className="icon" onClick={openAccount} title="حسابي">
          <Settings size={19} />
        </button>

        <button className="icon" onClick={logout} title="تسجيل الخروج">
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}

/* =========================================
   BOTTOM NAVIGATION — تنقل سفلي ثابت (UI بحت)
   بيستخدم نفس الـ props اللي كانت موجودة أصلاً (openAccount) من غير
   أي state أو منطق جديد يمس البيانات أو الـ Supabase queries.
========================================= */

function BottomNav({ active, setActive, items, openAccount }) {
  const icons = { home: HomeIcon, orders: Package, account: User };

  return (
    <nav className="bottomNav">
      {items.map((item) => {
        const Icon = icons[item.icon] || Home;
        const isActive = active === item.key;

        return (
          <button
            key={item.key}
            className={`bottomNavItem${isActive ? " active" : ""}`}
            onClick={() => {
              if (item.key === "account") {
                openAccount?.();
                return;
              }
              setActive(item.key);
            }}
          >
            <Icon size={21} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* =========================================
   CUSTOMER
========================================= */

function Customer({ profile, orders, drivers, refresh, flash, openAccount }) {
  const dialog = useDialog();
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState("home"); // تبويب الشريط السفلي - عرض فقط، بدون أي تأثير على البيانات

  const [serviceType, setServiceType] = useState(null);
  const [orderVehicleType, setOrderVehicleType] = useState(""); // نوع المركبة المطلوبة للطلب - إلزامي
  const [orderOffers, setOrderOffers] = useState([]);

  // ===== حالات واجهة فقط لفورم إنشاء الطلب (لا تؤثر على أي Query/API) =====
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isOrderFormValid, setIsOrderFormValid] = useState(true);
  const orderFormRef = useRef(null);

  function refreshOrderFormValidity() {
    if (orderFormRef.current) {
      setIsOrderFormValid(orderFormRef.current.checkValidity());
    }
  }

  const serviceTypeIcon = {
    purchase: ShoppingBag,
    delivery: Package,
    ride: Car,
  };
  const ServiceTypeIcon = serviceType ? serviceTypeIcon[serviceType] : null;

  // ===== صور المنتج لخدمة "اشتريهولي" فقط — واجهة + رفع اختياري =====
  const [purchaseImages, setPurchaseImages] = useState([]); // [{ file, previewUrl }]
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const purchaseFileInputRef = useRef(null);
  const purchaseImagesRef = useRef(purchaseImages);

  useEffect(() => {
    purchaseImagesRef.current = purchaseImages;
  }, [purchaseImages]);

  useEffect(() => {
    if (!show) {
      purchaseImagesRef.current.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      setPurchaseImages([]);
    }
  }, [show]);

  function handlePickPurchaseImages(e) {
    const selected = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );

    if (selected.length > 0) {
      setPurchaseImages((current) => {
        const room = Math.max(0, MAX_PURCHASE_IMAGES - current.length);

        const accepted = selected.slice(0, room).map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        return [...current, ...accepted];
      });
    }

    e.target.value = "";
  }

  function removePurchaseImage(index) {
    setPurchaseImages((current) => {
      const target = current[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  async function uploadPurchaseImages(images) {
    const folder = `${profile.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const urls = [];

    for (let i = 0; i < images.length; i++) {
      const compressed = await compressImageFile(images[i].file);
      const filePath = `${folder}/${i + 1}.jpg`;

      const { error } = await supabase.storage
        .from("order-images")
        .upload(filePath, compressed, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/jpeg",
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("order-images")
        .getPublicUrl(filePath);

      urls.push(data.publicUrl);
    }

    return urls;
  }

  // نحتفظ بآخر نسخة من orders في ref عشان قناة الإشعارات (order-offers-realtime)
  // متعملش unsubscribe/subscribe من جديد في كل مرة orders بتتغيّر (ده كان بيوقف
  // الإشعارات فجأة أحيانًا بسبب تصادم في اشتراكات Supabase Realtime)
  const ordersRef = useRef(orders);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    if (!show) return;

    // تأخير بسيط لضمان اكتمال الرندر قبل قراءة صلاحية الفورم (واجهة فقط)
    const t = setTimeout(refreshOrderFormValidity, 0);
    return () => clearTimeout(t);
  }, [show, serviceType]);

  useEffect(() => {
    if (!show) return;

    let showListener;
    let hideListener;

    async function setupKeyboard() {
      try {
        showListener = await Keyboard.addListener(
          "keyboardWillShow",
          (info) => {
            document.documentElement.style.setProperty(
              "--keyboard-height",
              `${info.keyboardHeight}px`,
            );

            document.body.classList.add("keyboard-open");

            setTimeout(() => {
              const active = document.activeElement;

              if (
                active &&
                active.matches(".modal input, .modal textarea, .modal select")
              ) {
                active.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }, 250);
          },
        );

        hideListener = await Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.style.setProperty(
            "--keyboard-height",
            "0px",
          );

          document.body.classList.remove("keyboard-open");
        });
      } catch (error) {
        console.log("Keyboard plugin unavailable:", error);
      }
    }

    setupKeyboard();

    return () => {
      showListener?.remove();
      hideListener?.remove();

      document.body.classList.remove("keyboard-open");

      document.documentElement.style.setProperty("--keyboard-height", "0px");
    };
  }, [show]);

  useEffect(() => {
    async function loadOffers() {
      if (!profile?.id) return;

      const orderIds = orders.map((order) => order.id);

      if (orderIds.length === 0) {
        setOrderOffers([]);
        return;
      }

      const { data, error } = await supabase
        .from("order_offers")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("LOAD OFFERS ERROR:", error);
        return;
      }

      setOrderOffers(data || []);
    }

    loadOffers();
  }, [orders, profile?.id]);
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`order-offers-realtime-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_offers",
        },
        (payload) => {
          console.log("🔄 عروض المندوبين اتغيرت");
          console.log("REALTIME PAYLOAD:", payload);
          console.log("EVENT TYPE:", payload.eventType);

          // ملحوظة: مبنعملش هنا new Notification() محلي عشان السيرفر أصلًا
          // بيبعت Push حقيقي (Web Push / FCM) لصاحب الطلب لحظة إرسال أو تعديل
          // العرض (شوف /api/push/offer). لو ضفنا إشعار تاني هنا كان بيظهر
          // إشعارين لنفس الحدث في نفس اللحظة - وده اللي كان بيسبب اللخبطة.
          // الجزء الجاي بس بيحدّث بيانات العروض جوه الصفحة (state).

          const affectedOrderId =
            payload.new?.order_id || payload.old?.order_id;

          const belongsToMyOrders = ordersRef.current.some(
            (order) => order.id === affectedOrderId,
          );

          if (belongsToMyOrders) {
            setOrderOffers((currentOffers) => {
              if (payload.eventType === "INSERT") {
                const alreadyExists = currentOffers.some(
                  (offer) => offer.id === payload.new.id,
                );

                if (alreadyExists) return currentOffers;

                return [payload.new, ...currentOffers];
              }

              if (payload.eventType === "UPDATE") {
                return currentOffers.map((offer) =>
                  offer.id === payload.new.id
                    ? { ...offer, ...payload.new }
                    : offer,
                );
              }

              if (payload.eventType === "DELETE") {
                return currentOffers.filter(
                  (offer) => offer.id !== payload.old.id,
                );
              }

              return currentOffers;
            });
          }
        },
      )
      .subscribe((status) => {
        console.log("📡 REALTIME STATUS:", status);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const [showAllOrders, setShowAllOrders] = useState(false);

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 3);
  const recentOrders = orders.slice(0, 3); // معاينة سريعة للرئيسية - نفس بيانات orders، بدون أي query جديد

  const availableDrivers = drivers.filter((driver) => {
    if (serviceType === "purchase" && driver.can_purchase === false) {
      return false;
    }

    if (serviceType === "delivery" && driver.can_delivery === false) {
      return false;
    }

    if (serviceType === "ride" && driver.can_ride !== true) {
      return false;
    }

    // لو العميل اختار نوع مركبة، نتأكد إن فيه على الأقل مندوب متاح بنفس
    // النوع ده، مش بس متاح لنفس نوع الخدمة. بدون الشرط ده، ممكن العميل
    // يبعت طلب "تروسيكل" مثلاً من غير ما ياخد أي تحذير، رغم إنه مفيش أي
    // مندوب تروسيكل متاح أصلاً، وميوصلوش أي إشعار من غير ما يعرف السبب.
    if (orderVehicleType && driver.vehicle_type !== orderVehicleType) {
      return false;
    }

    return true;
  });

  function openService(type) {
    setServiceType(type);
    setOrderVehicleType("");
    setShow(true);
  }

  async function createOrder(e) {
    e.preventDefault();

    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    try {
      await submitOrder(e);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  async function submitOrder(e) {
    if (!orderVehicleType) {
      flash("من فضلك اختر نوع المركبة المطلوبة أولاً");
      return;
    }

    const form = new FormData(e.currentTarget);

    /* =========================================
     البيانات الأساسية
  ========================================= */

    const suggestedPrice = Number(form.get("customerOfferPrice") || 0);

    let payload = {
      customer_id: profile.id,

      driver_id: null,
      customer_phone: form.get("phone"),

      notes: form.get("notes") || null,

      service_type: serviceType,

      // نوع المركبة اللي اختارها العميل لهذا الطلب
      vehicle_type: orderVehicleType,

      status: "requested",

      // السعر اللي العميل نفسه اقترحه للمشوار (اختياري)
      customer_offer_price: suggestedPrice > 0 ? suggestedPrice : null,
    };

    /* =========================================
     اشتريهولي
  ========================================= */

    if (serviceType === "purchase") {
      const estimatedPrice = Number(form.get("estimatedPrice") || 0);

      const currentLimit = Number(profile.purchase_limit || 500);

      if (estimatedPrice > currentLimit) {
        flash(`الحد الأقصى الحالي للمشتريات هو ${money(currentLimit)}`);

        return;
      }

      // رفع صور المنتج (اختياري) — لو مفيش صور، الطلب بيتبعت زي ما هو تمامًا
      let productImageUrls = [];

      if (purchaseImages.length > 0) {
        setIsUploadingImages(true);

        try {
          productImageUrls = await uploadPurchaseImages(purchaseImages);
        } catch (uploadError) {
          console.error("PRODUCT IMAGES UPLOAD ERROR:", uploadError);

          flash("تعذر رفع الصور، من فضلك حاول مرة أخرى");

          setIsUploadingImages(false);

          return;
        }

        setIsUploadingImages(false);
      }

      payload = {
        ...payload,

        items_description: form.get("items"),

        store_name: form.get("store"),

        estimated_items_price: estimatedPrice,

        delivery_address: form.get("address"),

        /*
        نحفظ وصف البداية والوجهة
        الموجود داخل الخريطة أيضًا
      */

        pickup_address: form.get("store"),

        product_images: productImageUrls.length > 0 ? productImageUrls : null,
      };
    }

    /* =========================================
     وصلهولي
  ========================================= */

    if (serviceType === "delivery") {
      payload = {
        ...payload,

        items_description: form.get("packageDescription"),

        package_description: form.get("packageDescription"),

        pickup_address: form.get("pickupAddress"),

        delivery_address: form.get("address"),

        recipient_name: form.get("recipientName"),

        recipient_phone: form.get("recipientPhone"),

        store_name: "توصيل طرد",
      };
    }

    /* =========================================
     توصيلة أشخاص
  ========================================= */

    if (serviceType === "ride") {
      const ridePickup = form.get("ridePickup");

      const rideDestination = form.get("rideDestination");

      payload = {
        ...payload,

        items_description: "توصيلة ركاب",

        store_name: "توصيلة",

        ride_pickup: ridePickup,

        ride_destination: rideDestination,

        ride_time: form.get("rideTime")
          ? new Date(form.get("rideTime")).toISOString()
          : null,

        passengers_count: Number(form.get("passengers") || 1),

        pickup_address: ridePickup,

        delivery_address: rideDestination,
      };
    }

    /* =========================================
     إنشاء الطلب
  ========================================= */

    const { error } = await supabase.from("orders").insert(payload);

    if (error) {
      console.error("CREATE ORDER ERROR:", error);

      flash(error.message || "تعذر إرسال الطلب");

      return;
    }
    // إرسال Push للمندوبين عند إنشاء طلب جديد
    // من غير await عمدًا — عشان المستخدم يشوف نتيجة الطلب فورًا
    // من غير ما ينتظر إرسال الإشعارات لكل المناديب في الخلفية
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          const serviceNames = {
            purchase: "شراء",
            delivery: "توصيل",
            ride: "مشوار",
          };

          const serviceName = serviceNames[serviceType] || "طلب";

          const suggestedPriceText =
            payload.customer_offer_price != null
              ? ` العميل مقترح سعر ${payload.customer_offer_price} جنيه.`
              : "";

          const response = await fetch("/api/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              title: `🔔 طلب ${serviceName} جديد`,
              message: `يوجد طلب جديد متاح، افتح مشوارك لمشاهدة التفاصيل وتقديم عرضك.${suggestedPriceText}`,
              url: "/",
              serviceType,
              vehicleType: orderVehicleType,
            }),
          });

          const result = await response.json();

          console.log("PUSH RESULT:", result);
        }
      } catch (pushError) {
        console.error("PUSH REQUEST ERROR:", pushError);
      }
    })();

    /* =========================================
     نجاح
  ========================================= */

    flash(
      serviceType === "ride"
        ? "تم إرسال طلب التوصيلة للمندوب"
        : "تم إرسال الطلب للمندوب",
    );

    purchaseImages.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setPurchaseImages([]);

    setShow(false);

    refresh();
  }

  async function decide(id, accepted) {
    const { error } = await supabase.rpc("customer_decide_offer", {
      p_order_id: id,
      p_accept: accepted,
    });

    if (error) {
      flash(error.message);
      return;
    }

    // إشعار المندوب بقرار العميل (من غير await، عشان العميل
    // يشوف نتيجة القرار فورًا من غير ما ينتظر إرسال الإشعار)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch("/api/push/decide", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId: id, accepted }),
          });
        }
      } catch (pushError) {
        console.error("PUSH DECIDE REQUEST ERROR:", pushError);
      }
    })();

    flash(accepted ? "تم قبول السعر" : "تم رفض العرض");

    refresh();
  }
  async function cancelOrder(id, reason) {
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: id,
      p_reason: reason || null,
    });

    if (error) {
      flash(error.message);
      return;
    }

    // إشعار المندوب (لو معين على الطلب) بإلغاء العميل (من غير await)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch("/api/push/cancel-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId: id, reason }),
          });
        }
      } catch (pushError) {
        console.error("PUSH CANCEL ORDER REQUEST ERROR:", pushError);
      }
    })();

    flash("تم إلغاء الطلب");

    refresh();
  }
  async function acceptDriverOffer(item) {
    if (!item?.id) {
      flash("بيانات العرض غير مكتملة");
      return;
    }

    const { error } = await supabase.rpc("customer_accept_driver_offer", {
      p_offer_id: item.id,
    });

    if (error) {
      console.error("ACCEPT OFFER ERROR:", error);
      flash(error.message);
      return;
    }

    // إشعار المندوب صاحب العرض المقبول (من غير await، عشان العميل
    // يشوف نتيجة القبول فورًا من غير ما ينتظر إرسال الإشعار)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch("/api/push/accept-offer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ offerId: item.id }),
          });
        }
      } catch (pushError) {
        console.error("PUSH ACCEPT OFFER REQUEST ERROR:", pushError);
      }
    })();

    // ثبّت السعر المقبول على الطلب نفسه كمصدر واحد للسعر النهائي.
    // لا نعدّل RPC الحالية حتى نحافظ على مسار الإسناد والإشعارات المستقر.
    const { error: priceError } = await supabase
      .from("orders")
      .update({ delivery_fee: Number(item.price) })
      .eq("id", item.order_id)
      .eq("customer_id", profile.id);

    if (priceError) {
      console.error("SAVE AGREED PRICE ERROR:", priceError);
      flash("تم قبول المندوب، لكن تعذر تثبيت السعر النهائي. حدّث الصفحة وحاول مرة أخرى.");
      refresh();
      return;
    }

    flash("تم قبول عرض المندوب بنجاح");
    refresh();
  }

  async function setSuggestedPrice(orderId, currentPrice) {
    const val = await dialog.prompt(
      "اكتب السعر اللي تقترحه للمشوار بالجنيه (سيبها فاضية عشان تشيل الاقتراح)",
      { defaultValue: currentPrice != null ? String(currentPrice) : "", numeric: true, placeholder: "مثلاً 40" },
    );

    if (val === null) return; // ضغط إلغاء

    if (val.trim() === "") {
      const { error } = await supabase
        .from("orders")
        .update({ customer_offer_price: null })
        .eq("id", orderId);

      if (error) {
        flash(error.message);
        return;
      }

      flash("تم حذف السعر المقترح");
      refresh();
      return;
    }

    if (isNaN(val) || Number(val) <= 0) {
      flash("اكتب سعر صحيح");
      return;
    }

    const { error } = await supabase
      .from("orders")
      .update({ customer_offer_price: Number(val) })
      .eq("id", orderId);

    if (error) {
      flash(error.message);
      return;
    }

    // إشعار المندوبين المتاحين بالسعر المقترح الجديد (من غير await،
    // عشان العميل يشوف نتيجة التحديث فورًا)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          const orderInfo = orders.find((order) => order.id === orderId);

          await fetch("/api/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              title: "🔔 تحديث سعر مقترح على مشوارك",
              message: `العميل اقترح سعر ${Number(val)} جنيه على طلب متاح، افتح مشوارك لمشاهدة التفاصيل.`,
              url: "/",
              serviceType: orderInfo?.service_type || null,
              vehicleType: orderInfo?.vehicle_type || null,
            }),
          });
        }
      } catch (pushError) {
        console.error("PUSH PRICE UPDATE REQUEST ERROR:", pushError);
      }
    })();

    flash("تم تحديث السعر المقترح");
    refresh();
  }
  return (
    <>
      {activeTab === "home" && (
      <>
      <section className="blueHero">
        <div className="dashIntroText">
          <h1>مشوارك النهارده إيه؟</h1>
          <p>اختار الخدمة اللي محتاجها وسيب الباقي علينا.</p>
        </div>
      </section>

      <div className="serviceGrid threeServices dashServiceGrid">
        <button className="serviceCard" onClick={() => openService("purchase")}>
          <ShoppingBag size={42} />

          <b>اشتريهولي</b>

          <span>خلي مندوب يشتري احتياجاتك ويوصلها لك.</span>
        </button>

        <button className="serviceCard" onClick={() => openService("delivery")}>
          <Package size={42} />

          <b>وصّلهولي</b>

          <span>ابعت حاجة أو طرد من مكان لمكان.</span>
        </button>

        <button
          className="serviceCard rideCard"
          onClick={() => openService("ride")}
        >
          <Car size={42} />

          <b>توصيلة</b>

          <span>عايز تروح مكان؟ اطلب توصيلة مناسبة ليك.</span>
        </button>
      </div>

      <div className="stats dashStats">
        <div>
          <Package />

          <b>{orders.length}</b>

          <span>كل مشاويرك</span>
        </div>

        <div>
          <Bike />

          <b>{drivers.length}</b>

          <span>مندوب متاح</span>
        </div>

        <div>
          <ShieldCheck />

          <b>{trustText[profile.trust_level] || "عميل جديد"}</b>

          <span>مستوى حسابك</span>
        </div>
      </div>

      <section className="section dashRecent">
        <div className="title">
          <div>
            <h2>آخر الطلبات</h2>
          </div>

          {orders.length > 0 && (
            <button
              type="button"
              className="viewAllLink"
              onClick={() => setActiveTab("orders")}
            >
              عرض الكل
            </button>
          )}
        </div>

        {recentOrders.length ? (
          recentOrders.map((order) => (
            <OrderCard
              key={order.id}
              o={order}
              customer
              setOfferPrice={setSuggestedPrice}
              currentUser={profile}
              decide={decide}
              offers={orderOffers.filter(
                (offer) => offer.order_id === order.id,
              )}
              drivers={drivers}
              acceptDriverOffer={acceptDriverOffer}
              cancelOrder={cancelOrder}
              refresh={refresh}
              flash={flash}
            />
          ))
        ) : (
          <Empty text="لسه معملتش أي مشوار." />
        )}
      </section>
      </>
      )}

      {activeTab === "orders" && (
      <section className="section">
        <div className="title">
          <div>
            <h2>آخر مشاويري</h2>

            <small>آخر الطلبات والرحلات</small>
          </div>

          <span>{orders.length} إجمالي</span>
        </div>

        {visibleOrders.length ? (
          visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              o={order}
              customer
              setOfferPrice={setSuggestedPrice}
              currentUser={profile}
              decide={decide}
              offers={orderOffers.filter(
                (offer) => offer.order_id === order.id,
              )}
              drivers={drivers}
              acceptDriverOffer={acceptDriverOffer}
              cancelOrder={cancelOrder}
              refresh={refresh}
              flash={flash}
            />
          ))
        ) : (
          <Empty text="لسه معملتش أي مشوار." />
        )}

        {orders.length > 3 && (
          <button
            className="showMoreButton"
            onClick={() => setShowAllOrders(!showAllOrders)}
          >
            {showAllOrders ? (
              <>
                <ChevronUp />
                عرض أقل
              </>
            ) : (
              <>
                <ChevronDown />
                عرض المزيد
              </>
            )}
          </button>
        )}
      </section>
      )}

      {show && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShow(false);
            }
          }}
        >
          <form
            className="modal orderModal"
            onSubmit={createOrder}
            ref={orderFormRef}
            onInput={refreshOrderFormValidity}
            onChange={refreshOrderFormValidity}
          >
            <button
              type="button"
              className="close"
              onClick={() => setShow(false)}
              aria-label="إغلاق"
            >
              ✕
            </button>

            <div className="orderModalHeader">
              {ServiceTypeIcon && (
                <span className="orderModalHeaderIcon">
                  <ServiceTypeIcon />
                </span>
              )}

              <div>
                <h2>{serviceInfo[serviceType]?.title}</h2>

                <p>{serviceInfo[serviceType]?.description}</p>
              </div>
            </div>

            <div className="orderFormBody">
              <section className="formSection">
                <h3 className="formSectionTitle">
                  <Bike /> نوع المركبة المطلوبة
                </h3>

                <div className="roles vehicleTypeRoles">
                  {VEHICLE_TYPES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      className={orderVehicleType === v.value ? "chosen" : ""}
                      onClick={() => setOrderVehicleType(v.value)}
                    >
                      <span aria-hidden="true">{v.emoji}</span>
                      {v.label}
                    </button>
                  ))}
                </div>

                {!orderVehicleType && (
                  <span className="fieldError" style={{ display: "block" }}>
                    من فضلك اختر نوع المركبة المطلوبة
                  </span>
                )}
              </section>

              {serviceType === "purchase" && (
                <>
                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <FileText /> معلومات الطلب
                    </h3>

                    <div className="formField">
                      <label>محتاج إيه؟</label>

                      <textarea
                        name="items"
                        required
                        placeholder="اكتب المنتجات والكميات بالتفصيل"
                      />

                      <span className="fieldError">
                        من فضلك اكتب المنتجات المطلوبة
                      </span>
                    </div>

                    <div className="formField">
                      <label>القيمة المتوقعة للمشتريات</label>

                      <input
                        name="estimatedPrice"
                        type="tel"
                        inputMode="numeric"
                        min="0"
                        required
                        placeholder={`حد حسابك ${profile.purchase_limit || 500} جنيه`}
                      />

                      <span className="fieldError">أدخل قيمة صحيحة</span>
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <Camera /> إرفاق صور (اختياري)
                    </h3>

                    <div className="imageUploadArea">
                      <input
                        ref={purchaseFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="imageUploadInput"
                        onChange={handlePickPurchaseImages}
                      />

                      {purchaseImages.length < MAX_PURCHASE_IMAGES && (
                        <button
                          type="button"
                          className="imageUploadTrigger"
                          onClick={() => purchaseFileInputRef.current?.click()}
                        >
                          <Camera />

                          <span>اضغط لإضافة صور للمنتج (اختياري)</span>

                          <small>
                            {purchaseImages.length}/{MAX_PURCHASE_IMAGES} صور
                          </small>
                        </button>
                      )}

                      {purchaseImages.length > 0 && (
                        <div className="imagePreviewGrid">
                          {purchaseImages.map((img, index) => (
                            <div className="imagePreviewItem" key={index}>
                              <img
                                src={img.previewUrl}
                                alt={`صورة المنتج ${index + 1}`}
                              />

                              <button
                                type="button"
                                className="imagePreviewRemove"
                                onClick={() => removePurchaseImage(index)}
                                aria-label="حذف الصورة"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <MapPin /> موقع الاستلام
                    </h3>

                    <div className="formField">
                      <label>منين؟</label>

                      <input
                        name="store"
                        required
                        placeholder="اسم المحل / المطعم / الصيدلية"
                      />

                      <span className="fieldError">
                        من فضلك حدد اسم المحل
                      </span>
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <Flag /> موقع التسليم
                    </h3>

                    <div className="formField">
                      <label>عنوان التوصيل</label>

                      <input
                        name="address"
                        required
                        placeholder="العنوان بالتفصيل"
                      />

                      <span className="fieldError">
                        من فضلك اكتب عنوان التوصيل
                      </span>
                    </div>
                  </section>
                </>
              )}

              {serviceType === "delivery" && (
                <>
                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <FileText /> معلومات الطلب
                    </h3>

                    <div className="formField">
                      <label>إيه الحاجة اللي هتتوصل؟</label>

                      <textarea
                        name="packageDescription"
                        required
                        placeholder="مثال: شنطة، أوراق، كرتونة..."
                      />

                      <span className="fieldError">
                        من فضلك اكتب وصف الحاجة
                      </span>
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <MapPin /> موقع الاستلام
                    </h3>

                    <div className="formField">
                      <label>عنوان الاستلام</label>

                      <input
                        name="pickupAddress"
                        required
                        placeholder="المكان اللي المندوب هيستلم منه"
                      />

                      <span className="fieldError">
                        من فضلك اكتب عنوان الاستلام
                      </span>
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <Flag /> موقع التسليم
                    </h3>

                    <div className="formField">
                      <label>عنوان التوصيل</label>

                      <input
                        name="address"
                        required
                        placeholder="المكان اللي الحاجة هتتسلم فيه"
                      />

                      <span className="fieldError">
                        من فضلك اكتب عنوان التسليم
                      </span>
                    </div>

                    <div className="formField">
                      <label>اسم المستلم</label>

                      <input
                        name="recipientName"
                        required
                        placeholder="اسم الشخص المستلم"
                      />

                      <span className="fieldError">
                        من فضلك اكتب اسم المستلم
                      </span>
                    </div>

                    <div className="formField">
                      <label>رقم المستلم</label>

                      <input
                        name="recipientPhone"
                        type="tel"
                        inputMode="numeric"
                        required
                        placeholder="رقم هاتف المستلم"
                      />

                      <span className="fieldError">
                        من فضلك اكتب رقم هاتف المستلم
                      </span>
                    </div>
                  </section>
                </>
              )}

              {serviceType === "ride" && (
                <>
                  <div className="rideNotice">
                    <Car />

                    <div>
                      <b>توصيلة أشخاص</b>

                      <span>
                        سيظهر لك فقط المندوبون المفعّل لهم نقل الركاب.
                      </span>
                    </div>
                  </div>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <FileText /> معلومات الطلب
                    </h3>

                    <div className="formField">
                      <label>عدد الركاب</label>

                      <input
                        name="passengers"
                        type="tel"
                        inputMode="numeric"
                        min="1"
                        max="8"
                        defaultValue="1"
                        required
                      />

                      <span className="fieldError">
                        أدخل عدد ركاب صحيح
                      </span>
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <MapPin /> موقع الاستلام
                    </h3>

                    <div className="formField">
                      <label>هتركب منين؟</label>

                      <input
                        name="ridePickup"
                        required
                        placeholder="نقطة الركوب بالتفصيل"
                      />

                      <span className="fieldError">
                        من فضلك حدد نقطة الركوب
                      </span>
                    </div>
                  </section>

                  <section className="formSection">
                    <h3 className="formSectionTitle">
                      <Flag /> موقع التسليم
                    </h3>

                    <div className="formField">
                      <label>رايح فين؟</label>

                      <input
                        name="rideDestination"
                        required
                        placeholder="الوجهة بالتفصيل"
                      />

                      <span className="fieldError">
                        من فضلك حدد الوجهة
                      </span>
                    </div>
                  </section>
                </>
              )}

              <section className="formSection">
                <h3 className="formSectionTitle">
                  <Wallet /> السعر
                </h3>

                <div className="formField">
                  <label>عايز تقترح سعر للمشوار؟ (اختياري)</label>

                  <input
                    name="customerOfferPrice"
                    type="tel"
                    inputMode="numeric"
                    min="0"
                    step="0.5"
                    placeholder="مثلاً 40 جنيه — سيبها فاضية لو مش عارف تحدد"
                  />
                </div>
              </section>

              <section className="formSection">
                <h3 className="formSectionTitle">
                  <MessageSquare /> تفاصيل إضافية
                </h3>

                <div className="formField">
                  <label>رقم التواصل</label>

                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    required
                    defaultValue={profile.phone || ""}
                  />

                  <span className="fieldError">
                    من فضلك اكتب رقم تواصل صحيح
                  </span>
                </div>

                <div className="formField">
                  <label>ملاحظات</label>

                  <input
                    name="notes"
                    placeholder="أي تفاصيل إضافية - اختياري"
                  />
                </div>
              </section>

              {availableDrivers.length === 0 && (
                <div className="riskWarning">
                  <AlertTriangle />

                  <div>
                    <b>لا يوجد مندوب متاح لهذه الخدمة حاليًا</b>

                    <span>جرّب مرة أخرى عندما يتوفر مندوب مناسب.</span>
                  </div>
                </div>
              )}
            </div>

            <button
              className="primary"
              disabled={
                availableDrivers.length === 0 ||
                isSubmittingOrder ||
                !isOrderFormValid ||
                !orderVehicleType
              }
            >
              {isSubmittingOrder ? (
                <>
                  <Loader2 className="spinIcon" />
                  {isUploadingImages ? "جاري رفع الصور..." : "جاري الإرسال..."}
                </>
              ) : (
                "إرسال الطلب"
              )}
            </button>

            <button
              type="button"
              className="ghost"
              onClick={() => setShow(false)}
            >
              إلغاء
            </button>
          </form>
        </div>
      )}

      <BottomNav
        active={activeTab}
        setActive={setActiveTab}
        openAccount={openAccount}
        items={[
          { key: "home", label: "الرئيسية", icon: "home" },
          { key: "orders", label: "طلباتي", icon: "orders" },
          { key: "account", label: "حسابي", icon: "account" },
        ]}
      />
    </>
  );
}
/* =========================================
   DRIVER
========================================= */

function Driver({ profile, orders, refresh, flash, openAccount }) {
  const dialog = useDialog();
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [activeTab, setActiveTab] = useState("home"); // تبويب الشريط السفلي - عرض فقط

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 3);
  const recentOrders = orders.slice(0, 3); // معاينة سريعة للرئيسية - نفس بيانات orders، بدون أي query جديد
  // إشعار المندوب عند قبول العميل لعرضه
  useEffect(() => {
    if (!profile?.id) return;

    const driverChannel = supabase
      .channel(`driver-accepted-offers-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_offers",
        },
        (payload) => {
          console.log("DRIVER OFFER UPDATE:", payload);

          if (payload.new?.status === "accepted") {
            // قبول أي عرض يعني أن الطلب لم يعد متاحًا لباقي المندوبين.
            // تحديث القائمة هنا مهم لأن تحديث orders قد لا يصل للمندوب الذي
            // فقد صلاحية رؤية الطلب بعد إسناده بسبب RLS. نستخدم نفس القناة
            // الموجودة بدل إنشاء قناة Realtime جديدة.
            if (payload.new?.driver_id === profile.id) {
              flash("🎉 تم قبول عرضك من العميل");
            }

            refresh();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(driverChannel);
    };
  }, [profile?.id]);
  // إشعار المندوب عند وصول طلب جديد
  useEffect(() => {
    if (!profile?.id) return;

    const newOrdersChannel = supabase
      .channel(`new-orders-driver-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("NEW ORDER RECEIVED:", payload);

          const newOrder = payload.new;

          // المندوب غير متاح = مفيش داعي نعمل أي حاجة
          if (profile?.is_available === false) return;

          // نتأكد أن نوع الخدمة مناسب للمندوب
          if (
            newOrder?.service_type === "purchase" &&
            profile?.can_purchase === false
          )
            return;

          if (
            newOrder?.service_type === "delivery" &&
            profile?.can_delivery === false
          )
            return;

          if (newOrder?.service_type === "ride" && profile?.can_ride === false)
            return;

          // نتأكد أن نوع المركبة المطلوبة للطلب يطابق نوع مركبة المندوب
          if (
            newOrder?.vehicle_type &&
            profile?.vehicle_type &&
            newOrder.vehicle_type !== profile.vehicle_type
          )
            return;

          // مبنعملش new Notification() هنا: السيرفر أصلًا بيبعت Push حقيقي
          // للمندوبين المتاحين واللي بيقدروا يخدموا نوع الطلب ده لحظة إنشاء
          // الطلب (شوف /api/push، فلترة serviceType). ده بيمنع ظهور إشعارين
          // لنفس الطلب الجديد.
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(newOrdersChannel);
    };
  }, [profile?.id]);

  async function changeAvailability() {
    const { error } = await supabase
      .from("profiles")
      .update({
        is_available: !profile.is_available,
      })
      .eq("id", profile.id);

    if (error) {
      flash(error.message);
      return;
    }

    refresh();
  }

  async function sendOffer(orderId, presetFee) {
    // presetFee بييجي لما المندوب يضغط "قبول السعر المقترح من العميل"
    // فنبعت السعر على طول من غير ما نفتح prompt
    let fee = presetFee;

    if (fee == null) {
      fee = await dialog.prompt("اكتب سعر المشوار بالجنيه", {
        numeric: true,
        placeholder: "مثلاً 50",
      });

      if (!fee) return;
    }

    if (isNaN(fee) || Number(fee) <= 0) {
      flash("اكتب سعر صحيح");
      return;
    }
    const { data: existingOffer, error: checkError } = await supabase
      .from("order_offers")
      .select("id")
      .eq("order_id", orderId)
      .eq("driver_id", profile.id)
      .maybeSingle();

    if (checkError) {
      flash(checkError.message);
      return;
    }

    let error;

    if (existingOffer) {
      // تعديل العرض الموجود
      const result = await supabase
        .from("order_offers")
        .update({
          price: Number(fee),
          status: "pending",
        })
        .eq("id", existingOffer.id)
        .eq("driver_id", profile.id);

      error = result.error;
    } else {
      // إنشاء عرض لأول مرة
      const result = await supabase.from("order_offers").insert({
        order_id: orderId,
        driver_id: profile.id,
        price: Number(fee),
        status: "pending",
      });

      error = result.error;
    }

    if (error) {
      flash(error.message);
      return;
    }

    // إشعار العميل بالسعر الجديد أو المعدّل (من غير await، عشان المندوب
    // يشوف نتيجة إرسال السعر فورًا)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch("/api/push/offer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              orderId,
              price: Number(fee),
              isUpdate: Boolean(existingOffer),
            }),
          });
        }
      } catch (pushError) {
        console.error("PUSH OFFER REQUEST ERROR:", pushError);
      }
    })();

    flash("تم إرسال السعر للعميل");

    refresh();
  }

  async function cancelOrder(id, reason) {
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: id,
      p_reason: reason || null,
    });

    if (error) {
      flash(error.message);
      return;
    }

    // إشعار العميل بإلغاء المندوب (من غير await)
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          await fetch("/api/push/cancel-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId: id, reason }),
          });
        }
      } catch (pushError) {
        console.error("PUSH CANCEL ORDER REQUEST ERROR:", pushError);
      }
    })();

    flash("تم إلغاء الطلب");

    refresh();
  }

  async function nextStatus(orderId, currentStatus, serviceType) {
    let newStatus = null;

    /* اشتريهولي */

    if (serviceType === "purchase") {
      const flow = {
        offer_accepted: "shopping",
        shopping: "purchased",
        purchased: "delivering",
        delivering: "delivered",
      };

      newStatus = flow[currentStatus];

      if (currentStatus === "shopping") {
        const itemsPrice = await dialog.prompt(
          "اكتب قيمة المشتريات الفعلية بالجنيه",
          { numeric: true, placeholder: "مثلاً 120" },
        );

        if (!itemsPrice) return;

        if (isNaN(itemsPrice) || Number(itemsPrice) < 0) {
          flash("اكتب قيمة مشتريات صحيحة");
          return;
        }

        const { error } = await supabase
          .from("orders")
          .update({
            status: newStatus,
            items_price: Number(itemsPrice),
          })
          .eq("id", orderId);

        if (error) {
          flash(error.message);
          return;
        }

        flash("تم تسجيل قيمة المشتريات");

        refresh();
        return;
      }
    }

    /* وصلهولي */

    if (serviceType === "delivery") {
      const flow = {
        offer_accepted: "delivering",
        delivering: "delivered",
      };

      newStatus = flow[currentStatus];
    }

    /* توصيلة */

    if (serviceType === "ride") {
      const flow = {
        offer_accepted: "driver_on_way",

        driver_on_way: "driver_arrived",

        driver_arrived: "ride_started",

        ride_started: "delivered",
      };

      newStatus = flow[currentStatus];
    }

    if (!newStatus) {
      return;
    }

    const payload = {
      status: newStatus,
    };

    if (newStatus === "ride_started") {
      payload.started_at = new Date().toISOString();
    }

    if (newStatus === "delivered") {
      payload.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", orderId);

    if (error) {
      flash(error.message);
      return;
    }

    if (newStatus === "delivered") {
      flash(
        serviceType === "ride"
          ? "تم إنهاء التوصيلة بنجاح"
          : "تم إكمال الطلب بنجاح",
      );
    } else {
      flash("تم تحديث حالة المشوار");
    }

    refresh();
  }

  if (profile.driver_status !== "approved") {
    return (
      <section className="pending">
        <ShieldCheck size={60} />

        <h2>حسابك قيد المراجعة</h2>

        <p>
          إدارة مشوارك تراجع بياناتك ومستندات التحقق قبل تفعيل استقبال المشاوير.
        </p>

        {profile.driver_status === "rejected" && (
          <div className="riskWarning">
            <AlertTriangle />

            <div>
              <b>لم يتم قبول الحساب</b>

              <span>راجع بياناتك وتواصل مع الإدارة لمعرفة السبب.</span>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <>
      {activeTab === "home" && (
      <>
      <section className="blueHero">
        <div className="dashIntroText">
          <h1>جاهز لمشوار جديد؟ 🛵</h1>
          <p>راجع التفاصيل كويس قبل ما تبدأ التنفيذ أو تدفع أي مبلغ.</p>
        </div>

        <button
          className={profile.is_available ? "online" : "offline"}
          onClick={changeAvailability}
        >
          {profile.is_available
            ? "متاح لاستقبال المشاوير"
            : "غير متاح حاليًا"}
        </button>
      </section>

      <div className="stats dashStats">
        <div>
          <Package />

          <b>{orders.length}</b>

          <span>كل المشاوير</span>
        </div>

        <div>
          <Star />

          <b>{Number(profile.rating || 5).toFixed(1)}</b>

          <span>تقييمك</span>
        </div>

        <div>
          <CheckCircle2 />

          <b>{profile.completed_orders || 0}</b>

          <span>مشوار مكتمل</span>
        </div>
      </div>

      <section className="section dashRecent">
        <div className="title">
          <div>
            <h2>آخر المشاوير</h2>
          </div>

          {orders.length > 0 && (
            <button
              type="button"
              className="viewAllLink"
              onClick={() => setActiveTab("orders")}
            >
              عرض الكل
            </button>
          )}
        </div>

        {recentOrders.length ? (
          recentOrders.map((order) => (
            <OrderCard
              key={order.id}
              o={order}
              driver
              currentUser={profile}
              offer={sendOffer}
              next={nextStatus}
              cancelOrder={cancelOrder}
              refresh={refresh}
              flash={flash}
            />
          ))
        ) : (
          <Empty text="مفيش مشاوير موجهة ليك حاليًا." />
        )}
      </section>
      </>
      )}

      {activeTab === "orders" && (
      <section className="section">
        <div className="title">
          <div>
            <h2>آخر مشاويري</h2>

            <small>الطلبات والرحلات الموجهة إليك</small>
          </div>

          <span>{orders.length} إجمالي</span>
        </div>

        {visibleOrders.length ? (
          visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              o={order}
              driver
              currentUser={profile}
              offer={sendOffer}
              next={nextStatus}
              cancelOrder={cancelOrder}
              refresh={refresh}
              flash={flash}
            />
          ))
        ) : (
          <Empty text="مفيش مشاوير موجهة ليك حاليًا." />
        )}

        {orders.length > 3 && (
          <button
            className="showMoreButton"
            onClick={() => setShowAllOrders(!showAllOrders)}
          >
            {showAllOrders ? (
              <>
                <ChevronUp />
                عرض أقل
              </>
            ) : (
              <>
                <ChevronDown />
                عرض المزيد
              </>
            )}
          </button>
        )}
      </section>
      )}

      <BottomNav
        active={activeTab}
        setActive={setActiveTab}
        openAccount={openAccount}
        items={[
          { key: "home", label: "الرئيسية", icon: "home" },
          { key: "orders", label: "مشاويري", icon: "orders" },
          { key: "account", label: "حسابي", icon: "account" },
        ]}
      />
    </>
  );
}

/* =========================================
   ORDER CARD
========================================= */

function OrderCard({
  o,
  customer,
  driver,
  currentUser,
  decide,
  offer,
  offers,
  drivers,
  acceptDriverOffer,
  setOfferPrice,
  next,
  cancelOrder,
  refresh,
  flash,
}) {
  const dialog = useDialog();
  const [ratingOpen, setRatingOpen] = useState(false);

  // فتح/قفل قسم "تفاصيل الطلب" — عرض بصري بحت زي ratingOpen بالظبط،
  // مفيش أي تأثير على البيانات أو الاستعلامات
  const [detailsOpen, setDetailsOpen] = useState(false);

  // عرض صور المنتج بالحجم الكامل (اشتريهولي فقط) — واجهة عرض بحتة
  const [lightboxImage, setLightboxImage] = useState(null);

  const [alreadyRated, setAlreadyRated] = useState(false);

  const total = Number(o.delivery_fee || 0) + Number(o.items_price || 0);

  const customerData = o.customer;

  const service = serviceInfo[o.service_type] || serviceInfo.purchase;

  const isNewCustomer =
    customerData &&
    (customerData.trust_level === "new" ||
      Number(customerData.completed_orders || 0) === 0);

  const highPurchase =
    o.service_type === "purchase" &&
    Number(o.estimated_items_price || 0) >= 500;

  const risky = driver && (isNewCustomer || highPurchase);

  // الطلب ده مُسند فعليًا للمندوب الحالي؟ (يعني العميل قبل عرضه)
  const isAssignedToMe = Boolean(
    driver && o.driver_id && currentUser?.id && o.driver_id === currentUser.id,
  );

  // بيانات التواصل الكاملة (اسم + تليفون) بتتجاب بس لما الطلب يبقى مُسند
  // للمندوب ده تحديدًا، مش ظاهرة لأي مندوب تاني بيتصفح الطلبات المتاحة
  const [contact, setContact] = useState(null);

  useEffect(() => {
    if (!isAssignedToMe) {
      setContact(null);
      return;
    }

    let cancelled = false;

    async function loadContact() {
      const { data, error } = await supabase
        .rpc("get_order_customer_contact", { p_order_id: o.id })
        .maybeSingle();

      if (!cancelled && !error) {
        setContact(data || null);
      }
    }

    loadContact();

    return () => {
      cancelled = true;
    };
  }, [isAssignedToMe, o.id]);

  const customerFirstName = customerData?.full_name
    ? customerData.full_name.split(" ")[0]
    : "عميل";

  useEffect(() => {
    async function checkRating() {
      if (o.status !== "delivered" || !currentUser?.id) {
        return;
      }

      const { data } = await supabase
        .from("ratings")
        .select("id")
        .eq("order_id", o.id)
        .eq("reviewer_id", currentUser.id)
        .maybeSingle();

      setAlreadyRated(Boolean(data));
    }

    checkRating();
  }, [o.id, o.status, currentUser?.id]);

  function actionText() {
    if (o.service_type === "purchase") {
      const labels = {
        offer_accepted: "بدأت شراء الطلب",

        shopping: "تم الشراء وإضافة السعر",

        purchased: "خرجت للتوصيل",

        delivering: "تم التسليم",
      };

      return labels[o.status] || "تحديث المشوار";
    }

    if (o.service_type === "delivery") {
      const labels = {
        offer_accepted: "استلمت الحاجة وبدأت التوصيل",

        delivering: "تم التسليم",
      };

      return labels[o.status] || "تحديث المشوار";
    }

    if (o.service_type === "ride") {
      const labels = {
        offer_accepted: "أنا في الطريق للعميل",

        driver_on_way: "وصلت لنقطة الركوب",

        driver_arrived: "بدأت الرحلة",

        ride_started: "تم الوصول",
      };

      return labels[o.status] || "تحديث التوصيلة";
    }

    return "تحديث المشوار";
  }

  async function submitRating(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const rating = Number(form.get("rating"));

    const comment = form.get("comment");

    let reviewedId;

    if (customer) {
      reviewedId = o.driver_id;
    }

    if (driver) {
      reviewedId = o.customer_id;
    }

    if (!reviewedId) {
      flash("تعذر تحديد المستخدم المراد تقييمه");

      return;
    }

    if (rating < 1 || rating > 5) {
      flash("اختر تقييمًا من 1 إلى 5");

      return;
    }

    const { error } = await supabase.from("ratings").insert({
      order_id: o.id,

      reviewer_id: currentUser.id,

      reviewed_id: reviewedId,

      rating,

      comment: comment || null,
    });

    if (error) {
      if (error.code === "23505") {
        flash("أنت قيّمت هذا المشوار بالفعل");

        setAlreadyRated(true);
      } else {
        flash(error.message);
      }

      return;
    }

    setAlreadyRated(true);
    setRatingOpen(false);

    flash("شكرًا، تم تسجيل تقييمك ⭐");

    refresh();
  }

  return (
    <article className="order">
      <div className="orderTop">
        <div>
          <small>
            {service.emoji} {service.title}
            {" — "}
            مشوار #{String(o.id).slice(0, 8)}
          </small>

          <h3>
            {o.service_type === "ride"
              ? `الوجهة: ${o.ride_pickup || ""} ← ${o.ride_destination || ""}`
              : o.service_type === "delivery"
                ? `المطلوب توصيله: ${o.package_description || o.items_description || ""}`
                : `المطلوب: ${o.items_description || ""}`}
          </h3>
        </div>

        <div className="orderTopMeta">
          <span className={`status ${o.status}`}>
            {statusText[o.status] || o.status}
          </span>
          <span className="orderTime">
            <Clock size={12} />
            {timeAgo(o.created_at)}
          </span>
        </div>
      </div>

      {/* معلومات العميل للمندوب - قبل الإسناد: بطاقة ثقة مختصرة بس */}

      {driver && customerData && !isAssignedToMe && (
        <div className="customerTrustChip">
          <div className="customerTrustAvatar">
            {customerData.avatar_url ? (
              <img src={customerData.avatar_url} alt={customerFirstName} />
            ) : (
              <User size={20} />
            )}
          </div>

          <div className="customerTrustBody">
            <div className="customerTrustTop">
              <b>{customerFirstName}</b>

              <span
                className={`trustPill trustPill-${customerData.trust_level || "new"}`}
              >
                {trustText[customerData.trust_level] || "عميل جديد"}
              </span>
            </div>

            <small>
              ⭐ {Number(customerData.rating || 5).toFixed(1)}
              {" · "}
              {customerData.completed_orders || 0} طلب مكتمل
              {" · "}
              {customerData.cancelled_orders || 0} ملغي
            </small>
          </div>
        </div>
      )}

      {/* بيانات تواصل كاملة - تظهر فقط بعد ما العميل يقبل عرض المندوب ده تحديدًا */}

      {driver && customerData && isAssignedToMe && (
        <div className="customerContactCard">
          <div className="customerContactHeader">
            {customerData.avatar_url ? (
              <img
                src={customerData.avatar_url}
                alt={contact?.full_name || customerData.full_name}
                className="customerContactAvatar"
              />
            ) : (
              <div className="customerContactAvatarFallback">
                <User size={26} />
              </div>
            )}

            <div>
              <small>عميلك في هذا المشوار</small>

              <h3>{contact?.full_name || customerData.full_name}</h3>

              <div className="customerContactRating">
                ⭐ {Number(customerData.rating || 5).toFixed(1)}
                {" · "}
                {customerData.completed_orders || 0} طلب مكتمل
              </div>
            </div>
          </div>

          {contact?.phone ? (
            <a className="customerContactCall" href={`tel:${contact.phone}`}>
              <Phone size={18} />
              <span>الاتصال بالعميل</span>
              <span className="customerContactNumber">{contact.phone}</span>
            </a>
          ) : (
            <div className="customerContactCall customerContactCall--loading">
              <Phone size={18} />
              <span>جاري تحميل رقم التواصل...</span>
            </div>
          )}
        </div>
      )}

      {/* حماية المندوب */}

      {risky && (
        <div className="riskWarning">
          <AlertTriangle />

          <div>
            <b>راجع المشوار قبل دفع أي مبلغ</b>

            <span>
              {isNewCustomer &&
                "هذا العميل جديد أو ليس لديه سجل طلبات مكتملة. "}
              {highPurchase &&
                `قيمة المشتريات المتوقعة ${money(o.estimated_items_price)}. `}
              تأكد من تفاصيل الطلب قبل الشراء.
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        className="detailsToggle"
        onClick={() => setDetailsOpen((open) => !open)}
        aria-expanded={detailsOpen}
      >
        <h4 className={`detailsHeading${detailsOpen ? " open" : ""}`}>تفاصيل الطلب</h4>
      </button>

      <div className={`detailsCollapse${detailsOpen ? " open" : ""}`}>
      <div className="detailsCollapseInner">

      <div className="details">
        {/* اشتريهولي */}

        {o.service_type === "purchase" && (
          <>
            <p>
              <Store />
              من: {o.store_name}
            </p>

            <p>
              <MapPin />
              التوصيل: {o.delivery_address}
            </p>

            {o.estimated_items_price != null && (
              <p>
                <ShoppingBag />
                قيمة متوقعة: {money(o.estimated_items_price)}
              </p>
            )}

            {Array.isArray(o.product_images) && o.product_images.length > 0 && (
              <div className="productImagesSection">
                <span className="productImagesLabel">
                  <Camera /> صور المنتج
                </span>

                <div className="productImagesGrid">
                  {o.product_images.map((url, index) => (
                    <button
                      type="button"
                      className="productImageThumb"
                      key={index}
                      onClick={() => setLightboxImage(url)}
                    >
                      <img src={url} alt={`صورة المنتج ${index + 1}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* وصلهولي */}

        {o.service_type === "delivery" && (
          <>
            <p>
              <MapPin />
              الاستلام: {o.pickup_address}
            </p>

            <p>
              <MapPin />
              التوصيل: {o.delivery_address}
            </p>

            <p>
              <User />
              المستلم: {o.recipient_name}
            </p>

            {o.recipient_phone && (
              <a className="detailsCall" href={`tel:${o.recipient_phone}`}>
                <Phone />
                رقم المستلم: {o.recipient_phone}
              </a>
            )}
          </>
        )}

        {/* توصيلة */}

        {o.service_type === "ride" && (
          <>
            <p>
              <MapPin />
              نقطة الركوب: {o.ride_pickup}
            </p>

            <p>
              <MapPin />
              الوجهة: {o.ride_destination}
            </p>

            <p>
              <Users />
              عدد الركاب: {o.passengers_count}
            </p>

            {o.ride_time && (
              <p>
                <Clock />
                الموعد: {new Date(o.ride_time).toLocaleString("ar-EG")}
              </p>
            )}
          </>
        )}
        {/* =========================================
    معلومات المسار والخريطة
========================================= */}

        {customer && o.driver && (
          <div className="driverInfoCard">
            <div className="driverInfoHeader">
              {o.driver.avatar_url ? (
                <img
                  src={o.driver.avatar_url}
                  alt={o.driver.full_name || "المندوب"}
                  className="driverAvatar"
                />
              ) : (
                <div className="driverAvatarFallback"><User size={26} /></div>
              )}

              <div>
                <small>المندوب المسؤول عن طلبك</small>

                <h3>{o.driver.full_name || "المندوب"}</h3>

                <div>
                  ⭐ {Number(o.driver.rating || 0).toFixed(1)}
                  {o.driver.rating_count
                    ? ` (${o.driver.rating_count} تقييم)`
                    : ""}
                </div>
              </div>
            </div>

            <div className="driverInfoDetails">
              {o.driver.phone && (
                <a href={`tel:${o.driver.phone}`}>
                  <Phone />
                  <span>الاتصال بالمندوب: {o.driver.phone}</span>
                </a>
              )}

              {o.driver.vehicle_type && (
                <div>
                  <Car />
                  <span>
                    {vehicleTypeLabel(o.driver.vehicle_type) ||
                      o.driver.vehicle_type}
                    {o.driver.vehicle_plate
                      ? ` — ${o.driver.vehicle_plate}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      </div>
      </div>

      {o.notes && (
        <div className="orderNote">
          <b>ملاحظات:</b> {o.notes}
        </div>
      )}

      {/* الحساب */}

      {o.delivery_fee != null && (
        <div className="bill">
          <div>
            <span>سعر المشوار</span>

            <b>{money(o.delivery_fee)}</b>
          </div>

          {o.service_type === "purchase" && o.items_price != null && (
            <>
              <div>
                <span>قيمة المشتريات</span>

                <b>{money(o.items_price)}</b>
              </div>

              <div className="total">
                <span>الإجمالي</span>

                <b>{money(total)}</b>
              </div>
            </>
          )}

          {o.service_type !== "purchase" && (
            <div className="total">
              <span>الإجمالي</span>

              <b>{money(o.delivery_fee)}</b>
            </div>
          )}
        </div>
      )}

      {/* قبول السعر */}

      {customer && o.status === "offer_sent" && (
        <div className="actions">
          <button className="accept" onClick={() => decide(o.id, true)}>
            <CheckCircle2 />
            قبول {money(o.delivery_fee)}
          </button>

          <button className="reject" onClick={() => decide(o.id, false)}>
            <XCircle />
            رفض
          </button>
        </div>
      )}
      {/* السعر المقترح من العميل */}

      {o.status === "requested" && !o.driver_id && (
        <div className="suggestedPrice">
          {o.customer_offer_price != null ? (
            <>
              <div className="suggestedPriceInfo">
                <span>السعر اللي اقترحته العميل</span>
                <b>{money(o.customer_offer_price)}</b>
              </div>

              {customer && (
                <button
                  type="button"
                  className="suggestedPriceEdit"
                  onClick={() => setOfferPrice(o.id, o.customer_offer_price)}
                >
                  تعديل السعر
                </button>
              )}

              {driver && (
                <button
                  type="button"
                  className="suggestedPriceAccept"
                  onClick={() => offer(o.id, o.customer_offer_price)}
                >
                  قبول السعر ده وإرساله
                </button>
              )}
            </>
          ) : (
            customer && (
              <button
                type="button"
                className="suggestedPriceAdd"
                onClick={() => setOfferPrice(o.id, null)}
              >
                + اقترح سعر للمشوار
              </button>
            )
          )}
        </div>
      )}

      {/* عروض أسعار المندوبين */}
      {customer && o.status === "requested" && offers?.length > 0 && (
        <div className="orderOffers">
          <h4>عروض المندوبين</h4>

          {offers.map((item) => {
            const offerDriver = drivers?.find((d) => d.id === item.driver_id);

            return (
              <div key={item.id} className="offerCard">
                <div className="offerDriver">
                  {offerDriver?.avatar_url ? (
                    <img
                      src={offerDriver.avatar_url}
                      alt={offerDriver.full_name || "المندوب"}
                      className="offerAvatar"
                    />
                  ) : (
                    <div className="offerAvatarFallback"><User size={22} /></div>
                  )}

                  <div className="offerDriverData">
                    <strong>{offerDriver?.full_name || "مندوب"}</strong>

                    <span>
                      🚗{" "}
                      {vehicleTypeLabel(offerDriver?.vehicle_type) ||
                        offerDriver?.vehicle_type ||
                        "وسيلة غير محددة"}
                    </span>

                    <span className="offerRating">
                      ⭐ {Number(offerDriver?.rating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="offerPrice">
                  <strong>{Number(item.price)}</strong>
                  <span>جنيه</span>
                </div>

                {customer && o.status === "requested" && (
                  <button
                    type="button"
                    className="offerAcceptButton"
                    onClick={() => acceptDriverOffer(item)}
                  >
                    قبول العرض
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* إرسال عرض */}

      {driver && o.status === "requested" && !o.driver_id && (
        <button className="primary newJobAction" onClick={() => offer(o.id)}>
          تحديد سعر المشوار وإرساله
        </button>
      )}

      {/* مراحل التنفيذ */}

      {driver &&
        [
          "offer_accepted",
          "shopping",
          "purchased",
          "delivering",
          "driver_on_way",
          "driver_arrived",
          "ride_started",
        ].includes(o.status) && (
          <button
            className="primary"
            onClick={() => next(o.id, o.status, o.service_type)}
          >
            {actionText()}
          </button>
        )}

      {/* إلغاء الطلب */}

      {!["delivered", "cancelled"].includes(o.status) && (
        <div className="actions">
          <button
            type="button"
            className="reject"
            onClick={async () => {
              const confirmed = await dialog.confirm(
                "متأكد إنك عايز تلغي الطلب ده؟",
              );

              if (!confirmed) return;

              const reason = await dialog.prompt(
                "سبب الإلغاء (اختياري)",
                { defaultValue: "", placeholder: "اكتب السبب لو حابب" },
              );

              await cancelOrder(o.id, reason || null);
            }}
          >
            <XCircle />
            إلغاء الطلب
          </button>
        </div>
      )}

      {o.cancelled_at && o.status === "cancelled" && (
        <div className="cancelledMessage">
          <XCircle />
          {o.cancel_reason ? `تم إلغاء الطلب - ${o.cancel_reason}` : "تم إلغاء هذا الطلب"}
        </div>
      )}

      {/* التقييم */}

      {o.status === "delivered" && !alreadyRated && (
        <div className="ratingArea">
          {!ratingOpen ? (
            <button className="rateButton" onClick={() => setRatingOpen(true)}>
              <Star />
              قيّم هذا المشوار
            </button>
          ) : (
            <form className="ratingForm" onSubmit={submitRating}>
              <h4>تجربتك كانت إيه؟</h4>

              <select name="rating" required defaultValue="">
                <option value="" disabled>
                  اختر التقييم
                </option>

                <option value="5">⭐⭐⭐⭐⭐ ممتاز</option>

                <option value="4">⭐⭐⭐⭐ جيد جدًا</option>

                <option value="3">⭐⭐⭐ جيد</option>

                <option value="2">⭐⭐ ضعيف</option>

                <option value="1">⭐ سيئ</option>
              </select>

              <textarea name="comment" placeholder="اكتب تعليقًا - اختياري" />

              <div className="actions">
                <button className="primary">إرسال التقييم</button>

                <button
                  type="button"
                  className="ghost"
                  onClick={() => setRatingOpen(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {o.status === "delivered" && alreadyRated && (
        <div className="ratedMessage">
          <CheckCircle2 />
          تم إرسال تقييمك لهذا المشوار
        </div>
      )}

      {lightboxImage && (
        <div
          className="imageLightboxOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLightboxImage(null);
          }}
        >
          <button
            type="button"
            className="imageLightboxClose"
            onClick={() => setLightboxImage(null)}
            aria-label="إغلاق"
          >
            ✕
          </button>

          <img src={lightboxImage} alt="صورة المنتج بالحجم الكامل" />
        </div>
      )}
    </article>
  );
}
/* =========================================
   ADMIN
========================================= */

function Admin({ logout, flash }) {
  const [profiles, setProfiles] = useState([]);

  const [orders, setOrders] = useState([]);

  const [documentUrls, setDocumentUrls] = useState({});

  const [showAllOrders, setShowAllOrders] = useState(false);

  const [expandedDrivers, setExpandedDrivers] = useState({});

  function toggleDriverDetails(driverId) {
    setExpandedDrivers((current) => ({
      ...current,
      [driverId]: !current[driverId],
    }));
  }

  async function load() {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (profileError) {
      flash(profileError.message);
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (orderError) {
      flash(orderError.message);
    }

    setProfiles(profileData || []);

    setOrders(orderData || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(driverId, status) {
    const { error } = await supabase
      .from("profiles")
      .update({
        driver_status: status,

        is_available: status === "approved" ? false : false,
      })
      .eq("id", driverId);

    if (error) {
      flash(error.message);
      return;
    }

    flash(status === "approved" ? "تم قبول المندوب بنجاح" : "تم رفض المندوب");

    load();
  }

  async function showDocument(driverId, filePath, side) {
    if (!filePath) {
      flash("لم يتم رفع هذه الصورة");

      return;
    }

    const { data, error } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(filePath, 120);

    if (error) {
      flash(error.message);
      return;
    }

    setDocumentUrls((current) => ({
      ...current,

      [`${driverId}-${side}`]: data.signedUrl,
    }));
  }

  async function toggleService(driver, field) {
    const newValue = !driver[field];

    const { error } = await supabase
      .from("profiles")
      .update({
        [field]: newValue,
      })
      .eq("id", driver.id);

    if (error) {
      flash(error.message);
      return;
    }

    const labels = {
      can_purchase: "اشتريهولي",

      can_delivery: "وصّلهولي",

      can_ride: "توصيلة",
    };

    flash(
      newValue
        ? `تم تفعيل خدمة ${labels[field]} للمندوب`
        : `تم إيقاف خدمة ${labels[field]} للمندوب`,
    );

    load();
  }

  const pendingDrivers = profiles.filter(
    (profile) =>
      profile.role === "driver" && profile.driver_status === "pending",
  );

  const approvedDrivers = profiles.filter(
    (profile) =>
      profile.role === "driver" && profile.driver_status === "approved",
  );

  const customers = profiles.filter((profile) => profile.role === "customer");

  const visibleAdminOrders = showAllOrders ? orders : orders.slice(0, 3);

  return (
    <div className="admin">
      <header>
        <div className="logo">
          مشوارك
          <span>●</span>
          <small className="adminBadge">Admin</small>
        </div>

        <button className="icon" onClick={logout}>
          <LogOut />
        </button>
      </header>

      <div className="adminHero">
        <small>إدارة مشوارك</small>

        <h1>لوحة التحكم</h1>

        <p>
          راجع المندوبين، فعّل الخدمات المناسبة لكل مندوب، وتابع نشاط المنصة.
        </p>
      </div>

      <div className="adminStats">
        <div>
          <b>{profiles.length}</b>

          <span>مستخدم</span>
        </div>

        <div>
          <b>{approvedDrivers.length}</b>

          <span>مندوب مفعل</span>
        </div>

        <div>
          <b>{customers.length}</b>

          <span>عميل</span>
        </div>

        <div>
          <b>{orders.length}</b>

          <span>مشوار</span>
        </div>
      </div>

      {/* =========================
          طلبات التفعيل
      ========================= */}

      <section className="section">
        <div className="title">
          <div>
            <h2>طلبات تفعيل المندوبين</h2>

            <small>مراجعة الهوية وبيانات وسيلة النقل</small>
          </div>

          <span>{pendingDrivers.length} بانتظار المراجعة</span>
        </div>

        {pendingDrivers.length ? (
          pendingDrivers.map((driver) => (
            <div className="adminRow" key={driver.id}>
              <div className="driverVerification">
                <div>
                  <b>{driver.full_name}</b>

                  <small>📞 {driver.phone || "غير مسجل"}</small>

                  <small>
                    🚗{" "}
                    {vehicleTypeLabel(driver.vehicle_type) ||
                      driver.vehicle_type ||
                      "وسيلة النقل غير مسجلة"}
                  </small>

                  {driver.vehicle_plate && (
                    <small>🔢 اللوحة: {driver.vehicle_plate}</small>
                  )}

                  <small>
                    🪪 الرقم القومي: {driver.national_id || "غير مسجل"}
                  </small>
                </div>

                <div className="documentButtons">
                  <button
                    className="ghost"
                    onClick={() =>
                      showDocument(driver.id, driver.id_card_front, "front")
                    }
                  >
                    <FileText />
                    البطاقة أمامي
                  </button>

                  <button
                    className="ghost"
                    onClick={() =>
                      showDocument(driver.id, driver.id_card_back, "back")
                    }
                  >
                    <FileText />
                    البطاقة خلفي
                  </button>
                </div>

                {documentUrls[`${driver.id}-front`] && (
                  <div className="documentPreview">
                    <span>الوجه الأمامي</span>

                    <img
                      src={documentUrls[`${driver.id}-front`]}
                      alt="البطاقة الأمامية"
                    />
                  </div>
                )}

                {documentUrls[`${driver.id}-back`] && (
                  <div className="documentPreview">
                    <span>الوجه الخلفي</span>

                    <img
                      src={documentUrls[`${driver.id}-back`]}
                      alt="البطاقة الخلفية"
                    />
                  </div>
                )}
              </div>

              <div className="adminDecision">
                <div className="approvalNotice">
                  <ShieldCheck />

                  <span>
                    بعد القبول يمكنك تحديد الخدمات المسموحة لهذا المندوب.
                  </span>
                </div>

                <div className="actions">
                  <button
                    className="accept"
                    onClick={() => approve(driver.id, "approved")}
                  >
                    <CheckCircle2 />
                    قبول
                  </button>

                  <button
                    className="reject"
                    onClick={() => approve(driver.id, "rejected")}
                  >
                    <XCircle />
                    رفض
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <Empty text="لا توجد طلبات تفعيل جديدة حاليًا." />
        )}
      </section>

      {/* =========================
          إدارة المندوبين والخدمات
      ========================= */}

      <section className="section">
        <div className="title">
          <div>
            <h2>المندوبون والخدمات</h2>

            <small>حدد نوع المشاوير المسموح لكل مندوب باستقبالها</small>
          </div>

          <span>{approvedDrivers.length} مندوب</span>
        </div>

        {approvedDrivers.length ? (
          approvedDrivers.map((driver) => (
            <div className="driverManageCard" key={driver.id}>
              <div className="driverManageTop">
                <div className="driverAvatar">
                  <Bike />
                </div>

                <div>
                  <h3>{driver.full_name}</h3>

                  <p>
                    {vehicleTypeLabel(driver.vehicle_type) ||
                      driver.vehicle_type ||
                      "وسيلة غير محددة"}

                    {driver.vehicle_plate ? ` — ${driver.vehicle_plate}` : ""}
                  </p>

                  <small>
                    ⭐ {Number(driver.rating || 5).toFixed(1)}
                    {" — "}
                    {driver.completed_orders || 0} مشوار مكتمل
                  </small>
                </div>

                <button
                  className="ghost"
                  style={{ marginInlineStart: "auto", width: "auto" }}
                  onClick={() => toggleDriverDetails(driver.id)}
                >
                  {expandedDrivers[driver.id] ? (
                    <>
                      <ChevronUp />
                      إخفاء التفاصيل
                    </>
                  ) : (
                    <>
                      <ChevronDown />
                      عرض التفاصيل الكاملة
                    </>
                  )}
                </button>
              </div>

              {expandedDrivers[driver.id] && (
                <div className="driverVerification" style={{ marginTop: 14 }}>
                  <div>
                    <small>📞 {driver.phone || "غير مسجل"}</small>

                    {driver.vehicle_plate && (
                      <small>🔢 اللوحة: {driver.vehicle_plate}</small>
                    )}

                    <small>
                      🪪 الرقم القومي: {driver.national_id || "غير مسجل"}
                    </small>
                  </div>

                  <div className="documentButtons">
                    <button
                      className="ghost"
                      onClick={() =>
                        showDocument(driver.id, driver.id_card_front, "front")
                      }
                    >
                      <FileText />
                      البطاقة أمامي
                    </button>

                    <button
                      className="ghost"
                      onClick={() =>
                        showDocument(driver.id, driver.id_card_back, "back")
                      }
                    >
                      <FileText />
                      البطاقة خلفي
                    </button>
                  </div>

                  {documentUrls[`${driver.id}-front`] && (
                    <div className="documentPreview">
                      <span>الوجه الأمامي</span>

                      <img
                        src={documentUrls[`${driver.id}-front`]}
                        alt="البطاقة الأمامية"
                      />
                    </div>
                  )}

                  {documentUrls[`${driver.id}-back`] && (
                    <div className="documentPreview">
                      <span>الوجه الخلفي</span>

                      <img
                        src={documentUrls[`${driver.id}-back`]}
                        alt="البطاقة الخلفية"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="servicePermissions">
                <button
                  className={
                    driver.can_purchase ? "permissionActive" : "permissionOff"
                  }
                  onClick={() => toggleService(driver, "can_purchase")}
                >
                  <ShoppingBag />

                  <span>اشتريهولي</span>

                  <b>{driver.can_purchase ? "مفعلة" : "متوقفة"}</b>
                </button>

                <button
                  className={
                    driver.can_delivery ? "permissionActive" : "permissionOff"
                  }
                  onClick={() => toggleService(driver, "can_delivery")}
                >
                  <Package />

                  <span>وصّلهولي</span>

                  <b>{driver.can_delivery ? "مفعلة" : "متوقفة"}</b>
                </button>

                <button
                  className={
                    driver.can_ride ? "permissionActive" : "permissionOff"
                  }
                  onClick={() => toggleService(driver, "can_ride")}
                >
                  <Car />

                  <span>توصيلة</span>

                  <b>{driver.can_ride ? "مفعلة" : "متوقفة"}</b>
                </button>
              </div>

              {!driver.can_ride && (
                <div className="rideAdminNote">
                  <AlertTriangle />

                  <span>
                    خدمة «توصيلة» لا تُفعّل إلا بعد التأكد من ملاءمة بيانات
                    المركبة والمتطلبات اللازمة لنقل الركاب.
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <Empty text="لا يوجد مندوبون مفعلون حتى الآن." />
        )}
      </section>

      {/* =========================
          آخر المشاوير
      ========================= */}

      <section className="section">
        <div className="title">
          <div>
            <h2>آخر المشاوير</h2>

            <small>متابعة أحدث نشاط على المنصة</small>
          </div>

          <span>{orders.length} إجمالي</span>
        </div>

        {visibleAdminOrders.length ? (
          visibleAdminOrders.map((order) => {
            const service =
              serviceInfo[order.service_type] || serviceInfo.purchase;

            return (
              <div className="adminOrder" key={order.id}>
                <div>
                  <b>
                    {service.emoji} {service.title}
                  </b>

                  <small>مشوار #{String(order.id).slice(0, 8)}</small>
                </div>

                <div className="adminOrderSide">
                  {order.delivery_fee != null && (
                    <b>{money(order.delivery_fee)}</b>
                  )}

                  <span className={`status ${order.status}`}>
                    {statusText[order.status] || order.status}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <Empty text="لا توجد مشاوير حتى الآن." />
        )}

        {orders.length > 3 && (
          <button
            className="showMoreButton"
            onClick={() => setShowAllOrders(!showAllOrders)}
          >
            {showAllOrders ? (
              <>
                <ChevronUp />
                عرض أقل
              </>
            ) : (
              <>
                <ChevronDown />
                عرض المزيد
              </>
            )}
          </button>
        )}
      </section>
    </div>
  );
}

/* =========================================
   EMPTY STATE
========================================= */

function Empty({ text }) {
  return (
    <div className="empty">
      <Package size={44} />

      <p>{text}</p>
    </div>
  );
}