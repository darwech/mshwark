package com.mshwark.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
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
        this.bridge.getWebView().setBackgroundColor(Color.parseColor("#0E2745"));

        createNotificationChannels();
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