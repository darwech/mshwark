package com.mshwark.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
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
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(Color.parseColor("#0E2745"));
        }

        createNotificationChannels();
        handleNotificationIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    // لو التطبيق اتفتح (أو كان شغال بالفعل) بسبب ضغط على إشعار، بنودّي
    // الـ WebView لصفحة الطلب/الرابط اللي جاي من السيرفر مع الإشعار
    private void handleNotificationIntent(Intent intent) {
        if (intent == null || this.bridge == null || this.bridge.getWebView() == null) return;

        String url = intent.getStringExtra("notificationUrl");
        if (url == null || url.isEmpty()) return;

        String safeUrl = url.replace("'", "");
        this.bridge.getWebView().post(() ->
                this.bridge.getWebView().evaluateJavascript(
                        "window.location.href='" + safeUrl + "'", null)
        );
    }

    @Override
public void onResume() {
    super.onResume();
    AppState.setForeground(true);
}

@Override
public void onPause() {
    super.onPause();
    AppState.setForeground(false);
}

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            // قناة إشعارات العميل
            NotificationChannel customerChannel = new NotificationChannel(
                    "customer_channel",
                    "إشعارات العملاء",
                    NotificationManager.IMPORTANCE_HIGH
            );
            Uri customerSound = Uri.parse(
                    "android.resource://" + getPackageName() + "/raw/customer_sound"
            );
            customerChannel.setSound(customerSound, audioAttributes);
            manager.createNotificationChannel(customerChannel);

            // قناة إشعارات المندوب
            NotificationChannel agentChannel = new NotificationChannel(
                    "agent_channel",
                    "إشعارات المندوبين",
                    NotificationManager.IMPORTANCE_HIGH
            );
            Uri agentSound = Uri.parse(
                    "android.resource://" + getPackageName() + "/raw/agent_sound"
            );
            agentChannel.setSound(agentSound, audioAttributes);
            manager.createNotificationChannel(agentChannel);
        }
    }
}