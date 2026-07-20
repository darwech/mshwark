import admin from "firebase-admin";

/**
 * تهيئة كسولة (Lazy) لـ Firebase Admin:
 * الاتصال بيحصل أول مرة الدالة تتنادى وقت التشغيل، مش وقت الـ import.
 * ده بيمنع فشل الـ Build لو متغير البيئة مش موجود وقت البناء.
 */
export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
    }

    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
    });
  }

  return admin;
}

export default admin;
