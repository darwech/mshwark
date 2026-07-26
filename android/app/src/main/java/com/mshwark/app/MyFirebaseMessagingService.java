package com.mshwark.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

// خدمة إضافية بتشتغل جنب خدمة Capacitor الافتراضية (مش بديلة ليها) —
// بتوصلها كل رسائل الـ FCM بشكل مستقل، وهي المسؤولة عن قرار: صوت بس؟
// ولا صوت + Heads-up؟ حسب حالة التطبيق (فاتح / خلفية-مقفول).
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();

        // مفيش داتا مخصصة (رسالة مش من نظامنا) - تجاهلها
        if (data == null || data.isEmpty()) return;

        String title = data.get("title");
        String body = data.get("body");
        String channelId = data.get("channelId");

        if (channelId == null || channelId.isEmpty()) {
            channelId = "customer_channel";
        }

        if (AppState.isForeground()) {
            // التطبيق فاتح: صوت بس، من غير أي Pop-up. تحديث محتوى الشاشة
            // بيحصل أصلًا لوحده عن طريق Supabase Realtime المشترك بالفعل.
            playChannelSound(channelId);
        } else {
            // التطبيق في الخلفية أو مقفول: إشعار كامل بصوت وHeads-up
            String url = data.get("url");
            showHeadsUpNotification(title, body, channelId, url);
        }
    }

    private void playChannelSound(String channelId) {
        try {
            int soundRes = "agent_channel".equals(channelId)
                    ? R.raw.agent_sound
                    : R.raw.customer_sound;

            MediaPlayer player = MediaPlayer.create(this, soundRes);
            if (player != null) {
                player.setOnCompletionListener(MediaPlayer::release);
                player.start();
            }
        } catch (Exception e) {
            Log.e("FCM_SOUND", "تعذر تشغيل صوت الإشعار", e);
        }
    }

    private void showHeadsUpNotification(String title, String body, String channelId, String url) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(this);

        // ID فريد لكل إشعار (بالميلي ثانية) عشان أي إشعار جديد يتعامل معاه
        // النظام كإشعار مستقل ١٠٠٪، مش تحديث لإشعار سابق - حتى لو جم أكتر
        // من إشعار خلال ثوانٍ من بعض أو خاصين بطلبات مختلفة
        int notificationId = (int) System.currentTimeMillis();

        // عند الضغط على الإشعار: يفتح MainActivity (يفتح التطبيق نفسه، وبما
        // إنه صفحة واحدة SPA بيحدّث نفسه لوحده عن طريق Realtime، ده كافي).
        // بنمرر الـ url كـ extra لو حبيت مستقبلًا تعمل توجيه لصفحة/طلب معين.
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null) {
            intent.putExtra("notificationUrl", url);
        }

        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notificationId, // request code فريد كمان عشان كل إشعار يفتح بالبيانات الصح بتاعته
                intent,
                pendingIntentFlags
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(title != null && !title.isEmpty() ? title : "مشوارك")
                .setContentText(body != null ? body : "")
                .setPriority(NotificationCompat.PRIORITY_HIGH) // Heads-up على أندرويد القديم
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        manager.notify(notificationId, builder.build());
    }
}
