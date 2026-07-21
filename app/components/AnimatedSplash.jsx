"use client";

import { useEffect, useState } from "react";

const FULL_NAME = "مشوارك";
const REVEAL_STEP_MS = 190; // الوقت بين ظهور كل حرف والتاني
const REVEAL_START_DELAY_MS = 950; // يبدأ بعد ما شعار الـ M يخلص رسمه

/**
 * شاشة تحميل متحركة بهوية "مشوارك" — تستخدم بدل نص التحميل الثابت
 * في أي مكان في التطبيق فيه انتظار (تسجيل الدخول، تجهيز الحساب... إلخ)
 */
export default function AnimatedSplash({ message = "جاري تحميل مشوارك..." }) {
  const [visibleChars, setVisibleChars] = useState(0);

  useEffect(() => {
    let interval;
    const startTimer = setTimeout(() => {
      let count = 1;
      setVisibleChars(count);

      interval = setInterval(() => {
        count += 1;
        setVisibleChars(count);

        if (count >= FULL_NAME.length) {
          clearInterval(interval);
        }
      }, REVEAL_STEP_MS);
    }, REVEAL_START_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="asplash">
      <div className="asplash-ring asplash-ring--1" />
      <div className="asplash-ring asplash-ring--2" />
      <div className="asplash-ring asplash-ring--3" />

      <div className="asplash-logo">
        <svg
          viewBox="0 0 200 150"
          className="asplash-logo-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polyline
            className="asplash-path"
            points="50,112 50,40 100,85 150,40 150,112"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle className="asplash-dot asplash-dot--l" cx="50" cy="112" r="16" />
          <circle className="asplash-dot asplash-dot--r" cx="150" cy="112" r="16" />
          <circle className="asplash-pulse asplash-pulse--l" cx="50" cy="112" r="16" />
          <circle className="asplash-pulse asplash-pulse--r" cx="150" cy="112" r="16" />
        </svg>
      </div>

      <div className="asplash-name" aria-label={FULL_NAME}>
        {FULL_NAME.slice(0, visibleChars)}
        <span className="asplash-caret" aria-hidden="true" />
      </div>

      <div className="asplash-loader" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="asplash-message">{message}</div>
    </div>
  );
}
