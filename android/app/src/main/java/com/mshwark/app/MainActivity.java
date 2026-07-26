package com.mshwark.app;

import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // نحدد خلفية الـ WebView من أول لحظة تبقى نفس لون splash_background
        // بالظبط (نفس القيمة المستخدمة في styles.xml و capacitor.config.json
        // ونفس أول لون في تدرج AnimatedSplash بالـ CSS) عشان مفيش أي قفزة
        // لونية محسوسة وقت الانتقال بين شاشة الفتح الأصلية وشاشة الحركة
        this.bridge.getWebView().setBackgroundColor(Color.parseColor("#0E2745"));
    }
}