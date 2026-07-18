# Hatly Production

مشروع ويب حقيقي مبني بـ Next.js + Supabase.

## الموجود
- تسجيل ودخول عميل/مندوب
- مراجعة وتفعيل المندوب بواسطة Admin
- إنشاء طلب واختيار مندوب متاح
- المندوب يرسل سعر المشوار
- العميل يقبل/يرفض السعر
- حالات الطلب حتى التسليم
- إدخال قيمة المشتريات وحساب الإجمالي
- إشعارات Realtime داخل النظام
- جداول تقييمات وإشعارات
- Row Level Security
- لوحة Admin أولية
- Responsive RTL UI
- بدون GPS/خرائط حسب المطلوب

## التشغيل
1. أنشئ مشروع Supabase.
2. افتح SQL Editor والصق محتوى `supabase/schema.sql` وشغله.
3. من Project Settings > API انسخ Project URL و anon key.
4. انسخ `.env.example` إلى `.env.local` وضع القيم.
5. شغل:
   npm install
   npm run dev

## جعل حساب Admin
بعد إنشاء حساب عادي، من Supabase SQL Editor:
update public.profiles set role='admin' where phone='رقمك';

## مهم قبل الإطلاق التجاري
- إضافة رفع صورة الفاتورة والمستندات إلى Supabase Storage.
- إعداد SMS/OTP لو أردت الدخول برقم الهاتف بدل البريد.
- إضافة سياسة خصوصية وشروط استخدام وسياسة نزاعات.
- اختبار RLS والأمان واختبارات قبول شاملة.
- ربط Vercel ونطاق مخصص.
- بوابة دفع لاحقًا إن لزم.
