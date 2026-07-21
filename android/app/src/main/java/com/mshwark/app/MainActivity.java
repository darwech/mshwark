package com.mshwark.app;

import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // نحدد خلفية الـ WebView من أول لحظة تبقى نفس أزرق هوية التطبيق
        // بدل اللون الأسود الافتراضي، عشان منشوفش أي ومضة سوداء بين
        // شاشة الفتح الأصلية وشاشة الحركة
        this.bridge.getWebView().setBackgroundColor(Color.parseColor("#0B2050"));
    }
}
