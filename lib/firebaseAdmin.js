import admin from "firebase-admin";

// بيتأكد إن الاتصال بـ Firebase يحصل مرة واحدة بس، مش مع كل طلب
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ),
  });
}

export default admin;
