import { createBrowserClient } from "@supabase/ssr";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const nativeStorage = {
  async getItem(key) {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.error("Native storage get error:", error);

      if (typeof window !== "undefined") {
        return window.localStorage.getItem(key);
      }

      return null;
    }
  },

  async setItem(key, value) {
    try {
      await Preferences.set({
        key,
        value,
      });
    } catch (error) {
      console.error("Native storage set error:", error);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    }
  },

  async removeItem(key) {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error("Native storage remove error:", error);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    }
  },
};

const isNative =
  typeof window !== "undefined" && Capacitor.isNativePlatform();

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: !isNative,
      storageKey: "mshwark-auth",
      ...(isNative
        ? {
            storage: nativeStorage,
          }
        : {}),
    },
  }
);