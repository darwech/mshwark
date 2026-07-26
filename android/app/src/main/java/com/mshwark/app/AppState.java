package com.mshwark.app;

import java.util.concurrent.atomic.AtomicBoolean;

// بيتابع هل التطبيق فاتح قدام المستخدم دلوقتي (Foreground) ولا لأ.
// بيتحدث من MainActivity في onResume/onPause.
public class AppState {
    private static final AtomicBoolean foreground = new AtomicBoolean(false);

    public static void setForeground(boolean value) {
        foreground.set(value);
    }

    public static boolean isForeground() {
        return foreground.get();
    }
}
