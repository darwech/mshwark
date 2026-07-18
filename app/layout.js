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
  themeColor: "#000000",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}