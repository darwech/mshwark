"use client";

/**
 * شاشة تحميل متحركة بهوية "مشوارك" — تستخدم بدل نص التحميل الثابت
 * في أي مكان في التطبيق فيه انتظار (تسجيل الدخول، تجهيز الحساب... إلخ)
 */
export default function AnimatedSplash({ message = "جاري تحميل مشوارك..." }) {
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

      <div className="asplash-name">مشوارك</div>

      <div className="asplash-loader" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="asplash-message">{message}</div>
    </div>
  );
}
