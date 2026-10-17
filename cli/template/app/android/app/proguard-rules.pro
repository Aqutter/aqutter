# Release 建置的 R8 規則。
#
# 為什麼需要：部分 Flutter plugin 的 Android 實作以 JNI 反射呼叫 Kotlin 方法（包含 suspend 函式），
# R8 看不到這些呼叫，會刪方法或把簽章裡的型別改名。實際症狀是 release 版一啟動就丟
# `NoSuchMethodError: no non-static method …SharedPreferencesApiRegistrar.getAll(…)`，殼顯示「啟動失敗」。
# debug 版不縮減，所以只有 release 會壞；shared_preferences_android 2.5.0 起才改用 JNI，
# 鎖在較舊版本（如 2.4.27）的專案不會遇到。

# Flutter 官方 plugin（shared_preferences、path_provider、url_launcher …）
-keep class io.flutter.plugins.** { *; }

# fluttercommunity 的 plus plugin（battery_plus、connectivity_plus、device_info_plus、package_info_plus）
-keep class dev.fluttercommunity.plus.** { *; }

# jni / jnigen 產生的綁定
-keep class com.github.dart_lang.jni.** { *; }

# Aqutter 殼與 aqutter_core
-keep class com.github.aqutter.** { *; }

# JNI 以原名反射呼叫 suspend 函式與協程類別（Lkotlin/coroutines/Continuation;、
# kotlin/coroutines/intrinsics/CoroutineSingletons …）。R8 把這些型別改名或刪掉時，
# shared_preferences_android 2.5.0 起（改用 JNI）會在啟動時丟 NoSuchMethodError / ClassNotFoundException。
# 與其一個一個猜，直接整包保留（約多 1 MB 以內）。
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
