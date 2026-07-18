"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function checkRecoverySession() {
      // Supabase قد يعيد code في الرابط
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

     

      // نتأكد أن هناك Session صالحة
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setReady(true);
      }

      setChecking(false);
    }

    checkRecoverySession();
  }, []);

  async function changePassword(e) {
    e.preventDefault();

    if (password.length < 6) {
      alert("كلمة المرور لازم تكون 6 أحرف على الأقل");
      return;
    }

    if (password !== confirmPassword) {
      alert("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert("حدث خطأ: " + error.message);
      return;
    }

    alert("تم تغيير كلمة المرور بنجاح ✅");

    await supabase.auth.signOut();

    window.location.href = "/";
  }

  if (checking) {
    return (
      <main className="resetPage">
        <div className="resetCard">
          <h1>مشوارك</h1>
          <p>جاري التحقق من رابط الاستعادة...</p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="resetPage">
        <div className="resetCard">
          <h1>مشوارك</h1>
          <h2>الرابط غير صالح أو انتهت صلاحيته</h2>

          <p>
            ارجع لصفحة تسجيل الدخول واطلب رابط استعادة جديد.
          </p>

          <button
            className="primary"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="resetPage">
      <div className="resetCard">

        <h1>مشوارك</h1>

        <h2>تعيين كلمة مرور جديدة</h2>

        <p>اكتب كلمة المرور الجديدة لحسابك</p>

        <form onSubmit={changePassword}>

          <input
            type="password"
            placeholder="كلمة المرور الجديدة"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="تأكيد كلمة المرور"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            required
          />

          <button
            className="primary"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "جاري الحفظ..."
              : "حفظ كلمة المرور الجديدة"}
          </button>

        </form>

      </div>
    </main>
  );
}