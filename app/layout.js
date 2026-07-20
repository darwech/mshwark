import "./globals.css";

export const metadata = {
  title: "مشوارك",
  description: "خدمات التوصيل والمشاوير بسهولة",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "مشوارك",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#0B2050", // كان #000000 — اتغيّر عشان يطابق لون البراند الجديد
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
