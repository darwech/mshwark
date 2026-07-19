"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Bike,
  Package,
  User,
  LogOut,
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

const money = (value) => `${Number(value || 0).toLocaleString("ar-EG")} ج`;

export default function Home() {
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
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!error) {
      setProfile(data || null);
    }
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
          phone,
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
      query = query.or(
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

    async function init() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);

      if (currentSession) {
        await loadProfile(currentSession.user);
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

  if (loading) {
    return <div className="center">جاري تحميل مشوارك...</div>;
  }

  if (!session) {
    return <Auth flash={flash} />;
  }

  if (!profile) {
    return <div className="center">جاري تجهيز حسابك...</div>;
  }

  if (profile.role === "admin") {
    return <Admin logout={() => supabase.auth.signOut()} flash={flash} />;
  }

  return (
    <div className="shell">
      <Header
        profile={profile}
        logout={() => supabase.auth.signOut()}
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
                  alert("كلمة المرور لازم تكون 6 أحرف على الأقل");
                  return;
                }

                if (newPassword !== confirmNewPassword) {
                  alert("كلمتا المرور غير متطابقتين");
                  return;
                }

                const { error } = await supabase.auth.updateUser({
                  password: newPassword,
                });

                if (error) {
                  alert("حدث خطأ: " + error.message);
                  return;
                }

                alert("تم تغيير كلمة المرور بنجاح ✅");

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
        />
      ) : (
        <Driver
          profile={profile}
          orders={orders}
          refresh={refresh}
          flash={flash}
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
  const [mode, setMode] = useState("login");

  const [role, setRole] = useState("customer");

  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");

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

      if (role === "driver" && (!driverAvatar || !cardFront || !cardBack)) {
        throw new Error(
          "لازم ترفع صورتك الشخصية وصورة البطاقة من الأمام والخلف",
        );
      }

      const metadata = {
        full_name: form.get("name"),

        phone: form.get("phone"),

        role,

        vehicle_type: role === "driver" ? form.get("vehicle") : null,

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
        <div className="seg">
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
                <input
                  name="vehicle"
                  required
                  placeholder="نوع وسيلة النقل - مثال: موتوسيكل / سيارة"
                />

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

        <input
          name="email"
          type="email"
          required
          placeholder="البريد الإلكتروني"
        />

        <input
          name="password"
          type="password"
          minLength={6}
          required
          placeholder="كلمة المرور"
        />
        {mode === "login" && authError && (
          <div className="authError">{authError}</div>
        )}

        <button className="primary" disabled={busy}>
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
              const email = prompt("اكتب البريد الإلكتروني المسجل به حسابك:");

              if (!email) return;

              const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim(),
                {
                  redirectTo: `${window.location.origin}/reset-password`,
                },
              );

              if (error) {
                alert("حصل خطأ: " + error.message);
                return;
              }

              alert(
                "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني ✅",
              );
            }}
          >
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

function Header({ profile, logout, openAccount }) {
  return (
    <header>
      <div className="logo">
        مشوارك
        <span>●</span>
      </div>

      <div className="headActions">
        <button
  className="icon"
  title="تفعيل الإشعارات"
  onClick={async () => {
    try {
      // التأكد إن الحساب موجود
      if (!profile?.id) {
        alert("يجب تسجيل الدخول أولًا");
        return;
      }

      // التأكد إن الجهاز يدعم Push Notifications
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        alert("جهازك أو المتصفح لا يدعم إشعارات Push");
        return;
      }

      // طلب إذن الإشعارات
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        alert(
          "لازم تسمح بالإشعارات علشان توصلك تحديثات مشوارك"
        );
        return;
      }

      // انتظار Service Worker
      const registration =
        await navigator.serviceWorker.ready;

      // البحث عن اشتراك موجود على نفس الجهاز
      let subscription =
        await registration.pushManager.getSubscription();

      // إنشاء اشتراك لو مفيش
      if (!subscription) {
        const publicKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          throw new Error(
            "VAPID Public Key غير موجود"
          );
        }

        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,

            applicationServerKey:
              urlBase64ToUint8Array(publicKey),
          });
      }

      const json = subscription.toJSON();

      if (
        !subscription.endpoint ||
        !json.keys?.p256dh ||
        !json.keys?.auth
      ) {
        throw new Error(
          "بيانات Push Subscription غير مكتملة"
        );
      }

      // نحصل على Session الحالية
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "جلسة تسجيل الدخول غير صالحة"
        );
      }

      // إرسال الاشتراك للسيرفر
      const response = await fetch(
        "/api/push/subscribe",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            endpoint: subscription.endpoint,

            p256dh: json.keys.p256dh,

            auth: json.keys.auth,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error(
          "PUSH SAVE ERROR:",
          result
        );

        throw new Error(
          result.error ||
            "فشل حفظ اشتراك الإشعارات"
        );
      }

      console.log(
        "PUSH SUBSCRIPTION SAVED:",
        result
      );

      alert(
        "تم تفعيل إشعارات مشوارك بنجاح 🔔"
      );
    } catch (error) {
      console.error(
        "PUSH SUBSCRIPTION ERROR:",
        error
      );

      alert(
        "تعذر تفعيل الإشعارات: " +
          (error?.message || "خطأ غير معروف")
      );
    }
  }}
>
  🔔
</button>
        <div className="hello">أهلاً، {profile.full_name?.split(" ")[0]}</div>

        <button className="icon" onClick={openAccount} title="حسابي">
          ⚙️
        </button>

        <button className="icon" onClick={logout} title="تسجيل الخروج">
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}

/* =========================================
   CUSTOMER
========================================= */

function Customer({ profile, orders, drivers, refresh, flash }) {
  const [show, setShow] = useState(false);

  const [serviceType, setServiceType] = useState(null);
  const [orderOffers, setOrderOffers] = useState([]);
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
          console.log("USER ROLE:", profile?.role);
          console.log(
            "NOTIFICATION PERMISSION:",
            "Notification" in window ? Notification.permission : "unsupported",
          );
          if (
            (payload.eventType === "INSERT" ||
              (payload.eventType === "UPDATE" &&
                payload.new?.status !== "accepted" &&
                Number(payload.old?.price) !== Number(payload.new?.price))) &&
            profile?.role === "customer" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const isNewOffer = payload.eventType === "INSERT";

            new Notification(
              isNewOffer ? "🔔 عرض جديد على مشوارك" : "🔔 تم تحديث عرض السعر",
              {
                body: isNewOffer
                  ? `وصلك عرض جديد بقيمة ${payload.new?.price ?? ""} جنيه`
                  : `تم تحديث العرض إلى ${payload.new?.price ?? ""} جنيه`,
                icon: "/icon-192.png",
              },
            );
          }

          const affectedOrderId =
  payload.new?.order_id || payload.old?.order_id;

const belongsToMyOrders = orders.some(
  (order) => order.id === affectedOrderId
);

if (belongsToMyOrders) {
  setOrderOffers((currentOffers) => {
    if (payload.eventType === "INSERT") {
      const alreadyExists = currentOffers.some(
        (offer) => offer.id === payload.new.id
      );

      if (alreadyExists) return currentOffers;

      return [payload.new, ...currentOffers];
    }

    if (payload.eventType === "UPDATE") {
      return currentOffers.map((offer) =>
        offer.id === payload.new.id
          ? { ...offer, ...payload.new }
          : offer
      );
    }

    if (payload.eventType === "DELETE") {
      return currentOffers.filter(
        (offer) => offer.id !== payload.old.id
      );
    }

    return currentOffers;
  });
}
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, orders]);

  const [showAllOrders, setShowAllOrders] = useState(false);

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 3);

  const availableDrivers = drivers.filter((driver) => {
    if (serviceType === "purchase") {
      return driver.can_purchase !== false;
    }

    if (serviceType === "delivery") {
      return driver.can_delivery !== false;
    }

    if (serviceType === "ride") {
      return driver.can_ride === true;
    }

    return true;
  });

  function openService(type) {
    setServiceType(type);
    setShow(true);
  }

  async function createOrder(e) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    /* =========================================
     البيانات الأساسية
  ========================================= */

    let payload = {
      customer_id: profile.id,

      driver_id: null,
      customer_phone: form.get("phone"),

      notes: form.get("notes") || null,

      service_type: serviceType,

      status: "requested",
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

        const response = await fetch("/api/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: `🔔 طلب ${serviceName} جديد`,
            message:
              "يوجد طلب جديد متاح، افتح مشوارك لمشاهدة التفاصيل وتقديم عرضك.",
            url: "/",
          }),
        });

        const result = await response.json();

        console.log("PUSH RESULT:", result);
      }
    } catch (pushError) {
      console.error("PUSH REQUEST ERROR:", pushError);
    }

    /* =========================================
     نجاح
  ========================================= */

    flash(
      serviceType === "ride"
        ? "تم إرسال طلب التوصيلة للمندوب"
        : "تم إرسال الطلب للمندوب",
    );

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

    flash(accepted ? "تم قبول السعر" : "تم رفض العرض");

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

    flash("تم قبول عرض المندوب بنجاح");
    refresh();
  }
  return (
    <>
      <section className="blueHero">
        <small>مشوارك V3</small>

        <h1>مشوارك النهارده إيه؟</h1>

        <p>
          شراء، توصيل حاجة، أو توصيلة ليك.. اختار الخدمة المناسبة وسيب الباقي
          علينا.
        </p>
      </section>

      <div className="serviceGrid threeServices">
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

      <div className="stats">
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
              currentUser={profile}
              decide={decide}
              offers={orderOffers.filter(
                (offer) => offer.order_id === order.id,
              )}
              drivers={drivers}
              acceptDriverOffer={acceptDriverOffer}
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

      {show && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShow(false);
            }
          }}
        >
          <form className="modal" onSubmit={createOrder}>
            <h2>
              {serviceInfo[serviceType]?.emoji}{" "}
              {serviceInfo[serviceType]?.title}
            </h2>

            <p>{serviceInfo[serviceType]?.description}</p>

            {serviceType === "purchase" && (
              <>
                <label>محتاج إيه؟</label>

                <textarea
                  name="items"
                  required
                  placeholder="اكتب المنتجات والكميات بالتفصيل"
                />

                <label>منين؟</label>

                <input
                  name="store"
                  required
                  placeholder="اسم المحل / المطعم / الصيدلية"
                />

                <label>القيمة المتوقعة للمشتريات</label>

                <input
                  name="estimatedPrice"
                  type="number"
                  min="0"
                  required
                  placeholder={`حد حسابك ${profile.purchase_limit || 500} جنيه`}
                />

                <label>عنوان التوصيل</label>

                <input name="address" required placeholder="العنوان بالتفصيل" />
              </>
            )}

            {serviceType === "delivery" && (
              <>
                <label>إيه الحاجة اللي هتتوصل؟</label>

                <textarea
                  name="packageDescription"
                  required
                  placeholder="مثال: شنطة، أوراق، كرتونة..."
                />

                <label>عنوان الاستلام</label>

                <input
                  name="pickupAddress"
                  required
                  placeholder="المكان اللي المندوب هيستلم منه"
                />

                <label>عنوان التوصيل</label>

                <input
                  name="address"
                  required
                  placeholder="المكان اللي الحاجة هتتسلم فيه"
                />

                <label>اسم المستلم</label>

                <input
                  name="recipientName"
                  required
                  placeholder="اسم الشخص المستلم"
                />

                <label>رقم المستلم</label>

                <input
                  name="recipientPhone"
                  required
                  placeholder="رقم هاتف المستلم"
                />
              </>
            )}

            {serviceType === "ride" && (
              <>
                <div className="rideNotice">
                  <Car />

                  <div>
                    <b>توصيلة أشخاص</b>

                    <span>سيظهر لك فقط المندوبون المفعّل لهم نقل الركاب.</span>
                  </div>
                </div>

                <label>هتركب منين؟</label>

                <input
                  name="ridePickup"
                  required
                  placeholder="نقطة الركوب بالتفصيل"
                />

                <label>رايح فين؟</label>

                <input
                  name="rideDestination"
                  required
                  placeholder="الوجهة بالتفصيل"
                />

                <label>موعد التوصيلة</label>

                <input name="rideTime" type="datetime-local" />

                <label>عدد الركاب</label>

                <input
                  name="passengers"
                  type="number"
                  min="1"
                  max="8"
                  defaultValue="1"
                  required
                />
              </>
            )}

            <label>رقم التواصل</label>

            <input name="phone" required defaultValue={profile.phone || ""} />

            {availableDrivers.length === 0 && (
              <div className="riskWarning">
                <AlertTriangle />

                <div>
                  <b>لا يوجد مندوب متاح لهذه الخدمة حاليًا</b>

                  <span>جرّب مرة أخرى عندما يتوفر مندوب مناسب.</span>
                </div>
              </div>
            )}

            <label>ملاحظات</label>

            <input name="notes" placeholder="أي تفاصيل إضافية - اختياري" />

            <button
              className="primary"
              disabled={availableDrivers.length === 0}
            >
              إرسال الطلب
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
    </>
  );
}
/* =========================================
   DRIVER
========================================= */

function Driver({ profile, orders, refresh, flash }) {
  const [showAllOrders, setShowAllOrders] = useState(false);

  const visibleOrders = showAllOrders ? orders : orders.slice(0, 3);
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

          if (
            payload.new?.driver_id === profile.id &&
            payload.new?.status === "accepted"
          ) {
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification("تم قبول عرضك 🎉", {
                body: "وافق العميل على عرضك، افتح مشوارك لمشاهدة تفاصيل الطلب.",
                icon: "/icon-192.png",
              });
            }

            flash("🎉 تم قبول عرضك من العميل");
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

          // المندوب غير متاح = لا نرسل إشعار
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

          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const serviceNames = {
              purchase: "شراء",
              delivery: "توصيل",
              ride: "مشوار",
            };

            const serviceName = serviceNames[newOrder?.service_type] || "خدمة";

            new Notification(`🔔 طلب ${serviceName} جديد`, {
              body: "يوجد طلب جديد متاح، افتح مشوارك لمشاهدة التفاصيل وتقديم عرضك.",
              icon: "/icon-192.png",
            });
          }

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

  async function sendOffer(orderId) {
    const fee = prompt("اكتب سعر المشوار بالجنيه");

    if (!fee) return;

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

    flash("تم إرسال السعر للعميل");

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
        const itemsPrice = prompt("اكتب قيمة المشتريات الفعلية بالجنيه");

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
      <section className="blueHero">
        <small>مندوب مشوارك</small>

        <h1>جاهز لمشوار جديد؟ 🛵</h1>

        <p>
          راجع تفاصيل العميل والمشوار كويس قبل ما تبدأ التنفيذ أو تدفع أي مبلغ.
        </p>

        <button
          className={profile.is_available ? "online" : "offline"}
          onClick={changeAvailability}
        >
          {profile.is_available
            ? "● متاح لاستقبال المشاوير"
            : "○ غير متاح حاليًا"}
        </button>
      </section>

      <div className="stats">
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
  next,
  refresh,
  flash,
}) {
  const [ratingOpen, setRatingOpen] = useState(false);

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
              ? `${o.ride_pickup || ""} ← ${o.ride_destination || ""}`
              : o.service_type === "delivery"
                ? o.package_description || o.items_description
                : o.items_description}
          </h3>
        </div>

        <span className={`status ${o.status}`}>
          {statusText[o.status] || o.status}
        </span>
      </div>

      {/* معلومات العميل للمندوب */}

      {driver && customerData && (
        <div className="trustBox">
          <ShieldCheck size={26} />

          <div>
            <b>{trustText[customerData.trust_level] || "عميل جديد"}</b>

            <small>
              {customerData.completed_orders || 0} مكتمل
              {" — "}
              {customerData.cancelled_orders || 0} ملغي
              {" — ⭐ "}
              {Number(customerData.rating || 5).toFixed(1)}
            </small>
          </div>
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

            <p>
              <Phone />

              {o.recipient_phone}
            </p>
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
                <div className="driverAvatarFallback">👤</div>
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
                  <span>{o.driver.phone}</span>
                </a>
              )}

              {o.driver.vehicle_type && (
                <div>
                  <Car />
                  <span>
                    {o.driver.vehicle_type}
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
                    <div className="offerAvatarFallback">👤</div>
                  )}

                  <div className="offerDriverData">
                    <strong>{offerDriver?.full_name || "مندوب"}</strong>

                    <span>
                      🚗 {offerDriver?.vehicle_type || "وسيلة غير محددة"}
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
        <button className="primary" onClick={() => offer(o.id)}>
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
                    🚗 {driver.vehicle_type || "وسيلة النقل غير مسجلة"}
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
                    {driver.vehicle_type || "وسيلة غير محددة"}

                    {driver.vehicle_plate ? ` — ${driver.vehicle_plate}` : ""}
                  </p>

                  <small>
                    ⭐ {Number(driver.rating || 5).toFixed(1)}
                    {" — "}
                    {driver.completed_orders || 0} مشوار مكتمل
                  </small>
                </div>
              </div>

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
