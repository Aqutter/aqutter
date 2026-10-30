package com.github.aqutter.shell;

import android.app.AlarmManager;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;
import io.flutter.plugin.common.PluginRegistry;

/**
 * 殼套件自己的本機通知（Android）。
 *
 * Dart 端的約定見 shell/lib/src/bridge/notification_service.dart 的 PlatformLocalNotifier：
 *   initialize / show / schedule / cancel / cancelAll / launchedBy（Dart → 原生）
 *   tapped（原生 → Dart，App 執行中使用者點了通知）
 *
 * 排程用 AlarmManager.setAndAllowWhileIdle（不需要精確鬧鐘權限，系統可能延後數分鐘），時間到由
 * {@link AqutterNotificationReceiver} 顯示；尚未到時間的排程存在 SharedPreferences，裝置重新開機或 App 更新後
 * 由 {@link AqutterBootReceiver} 重新排上（已過時間的不補發）。
 */
final class AqutterNotifications implements MethodChannel.MethodCallHandler, PluginRegistry.NewIntentListener {
    static final String CHANNEL = "com.github.aqutter/notifications";
    static final String CHANNEL_ID = "aqutter_default";
    static final String CHANNEL_NAME = "通知";

    static final String EXTRA_ID = "com.github.aqutter.notification.id";
    static final String EXTRA_TITLE = "com.github.aqutter.notification.title";
    static final String EXTRA_BODY = "com.github.aqutter.notification.body";
    static final String EXTRA_PAYLOAD = "com.github.aqutter.notification.payload";

    private static final String TAG = "AqutterNotify";
    private static final String PREFS = "com.github.aqutter.notifications";
    private static final String KEY_SCHEDULED = "scheduled";

    private final Context context;
    private final MethodChannel channel;

    /** 由通知冷啟 App 時的資訊；同一個程序內重複讀取回傳相同值。 */
    @Nullable
    private Map<String, Object> launch;

    /** Dart 端已呼叫過 initialize：此後的點擊以事件送給 Dart，之前的點擊視為「點通知而冷啟」。 */
    private boolean dartReady = false;

    AqutterNotifications(@NonNull Context context, @NonNull MethodChannel channel) {
        this.context = context.getApplicationContext();
        this.channel = channel;
        channel.setMethodCallHandler(this);
    }

    void detach() {
        channel.setMethodCallHandler(null);
    }

    // ---- Activity：冷啟與執行中的點擊 ----

    void onActivityAttached(@NonNull Activity activity) {
        Map<String, Object> info = readTap(activity.getIntent());
        if (info != null && launch == null) {
            launch = info;
        }
    }

    @Override
    public boolean onNewIntent(@NonNull Intent intent) {
        Map<String, Object> info = readTap(intent);
        if (info == null) {
            return false;
        }
        intent.removeExtra(EXTRA_ID);
        intent.removeExtra(EXTRA_PAYLOAD);
        if (dartReady) {
            channel.invokeMethod("tapped", info);
        } else if (launch == null) {
            // App 的程序被殺掉後點通知：系統先用原本的啟動 Intent 重建 Activity，再以 onNewIntent 送來
            // 點擊的 Intent，這時 Dart 還沒就緒，事件會被丟棄；記成冷啟資訊，等網頁用 launchedBy 取走
            launch = info;
        }
        return true;
    }

    @Nullable
    private static Map<String, Object> readTap(@Nullable Intent intent) {
        if (intent == null || !intent.hasExtra(EXTRA_ID)) {
            return null;
        }
        Map<String, Object> info = new HashMap<>();
        info.put("id", intent.getIntExtra(EXTRA_ID, 0));
        info.put("payload", intent.getStringExtra(EXTRA_PAYLOAD));
        return info;
    }

    // ---- Dart 端的呼叫 ----

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
        try {
            switch (call.method) {
                case "initialize":
                    ensureChannel(context);
                    dartReady = true;
                    result.success(null);
                    break;
                case "show":
                    post(context, id(call), call.<String>argument("title"), call.<String>argument("body"), call.<String>argument("payload"));
                    result.success(null);
                    break;
                case "schedule":
                    schedule(context, id(call), call.<String>argument("title"), call.<String>argument("body"),
                            call.<String>argument("payload"), longArgument(call, "atMs"));
                    result.success(null);
                    break;
                case "cancel":
                    cancel(context, id(call));
                    result.success(null);
                    break;
                case "cancelAll":
                    cancelAll(context);
                    result.success(null);
                    break;
                case "launchedBy":
                    result.success(launch);
                    break;
                default:
                    result.notImplemented();
            }
        } catch (Exception error) {
            Log.e(TAG, call.method + " failed", error);
            result.error("notification_failed", error.getMessage(), null);
        }
    }

    private static int id(MethodCall call) {
        Integer id = call.argument("id");
        if (id == null) {
            throw new IllegalArgumentException("id is required");
        }
        return id;
    }

    private static long longArgument(MethodCall call, String key) {
        Number value = call.argument(key);
        if (value == null) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value.longValue();
    }

    // ---- 顯示 ----

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT));
        }
    }

    /** 立即顯示；點通知會開啟 App 並帶 id 與 payload。沒有通知權限時系統會直接丟掉，Dart 端已先檢查。 */
    static void post(Context context, int id, String title, @Nullable String body, @Nullable String payload) {
        ensureChannel(context);
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) {
            throw new IllegalStateException("no launch intent for " + context.getPackageName());
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launch.putExtra(EXTRA_ID, id);
        launch.putExtra(EXTRA_PAYLOAD, payload);
        PendingIntent tap = PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body == null ? "" : body)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
            Log.d(TAG, "posted id=" + id);
        } catch (SecurityException error) {
            Log.w(TAG, "notification permission missing, dropped id=" + id, error);
        }
    }

    // ---- 排程 ----

    private static PendingIntent alarmIntent(Context context, int id, @Nullable String title, @Nullable String body, @Nullable String payload, int flags) {
        Intent intent = new Intent(context, AqutterNotificationReceiver.class);
        intent.putExtra(EXTRA_ID, id);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_BODY, body);
        intent.putExtra(EXTRA_PAYLOAD, payload);
        return PendingIntent.getBroadcast(context, id, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context context, int id, String title, @Nullable String body, @Nullable String payload, long atMs) throws JSONException {
        saveScheduled(context, id, title, body, payload, atMs);
        setAlarm(context, id, title, body, payload, atMs);
        Log.d(TAG, "scheduled id=" + id + " at=" + atMs + " in " + (atMs - System.currentTimeMillis()) + " ms");
    }

    static void setAlarm(Context context, int id, String title, @Nullable String body, @Nullable String payload, long atMs) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pending = alarmIntent(context, id, title, body, payload, PendingIntent.FLAG_UPDATE_CURRENT);
        // 不需要精確鬧鐘權限；系統可能延後數分鐘（契約 §5）
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pending);
    }

    static void cancel(Context context, int id) throws JSONException {
        cancelAlarm(context, id);
        removeScheduled(context, id);
        NotificationManagerCompat.from(context).cancel(id);
    }

    static void cancelAll(Context context) throws JSONException {
        JSONArray scheduled = loadScheduled(context);
        for (int i = 0; i < scheduled.length(); i++) {
            cancelAlarm(context, scheduled.getJSONObject(i).getInt("id"));
        }
        prefs(context).edit().remove(KEY_SCHEDULED).apply();
        NotificationManagerCompat.from(context).cancelAll();
    }

    private static void cancelAlarm(Context context, int id) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent existing = alarmIntent(context, id, null, null, null, PendingIntent.FLAG_NO_CREATE);
        if (existing != null) {
            alarms.cancel(existing);
            existing.cancel();
        }
    }

    // ---- 排程的保存（重開機後重新排程用） ----

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static synchronized JSONArray loadScheduled(Context context) {
        String raw = prefs(context).getString(KEY_SCHEDULED, null);
        if (raw == null) {
            return new JSONArray();
        }
        try {
            return new JSONArray(raw);
        } catch (JSONException error) {
            return new JSONArray();
        }
    }

    private static synchronized void saveScheduled(Context context, int id, String title, @Nullable String body, @Nullable String payload, long atMs) throws JSONException {
        JSONArray next = new JSONArray();
        JSONArray current = loadScheduled(context);
        for (int i = 0; i < current.length(); i++) {
            if (current.getJSONObject(i).getInt("id") != id) {
                next.put(current.getJSONObject(i));
            }
        }
        JSONObject entry = new JSONObject();
        entry.put("id", id);
        entry.put("title", title);
        entry.put("body", body);
        entry.put("payload", payload);
        entry.put("atMs", atMs);
        next.put(entry);
        prefs(context).edit().putString(KEY_SCHEDULED, next.toString()).apply();
    }

    static synchronized void removeScheduled(Context context, int id) throws JSONException {
        JSONArray next = new JSONArray();
        JSONArray current = loadScheduled(context);
        for (int i = 0; i < current.length(); i++) {
            if (current.getJSONObject(i).getInt("id") != id) {
                next.put(current.getJSONObject(i));
            }
        }
        prefs(context).edit().putString(KEY_SCHEDULED, next.toString()).apply();
    }

    /** 重開機或 App 更新後重新排上尚未到時間的通知；已過時間的丟掉，不補發。 */
    static synchronized void rescheduleAll(Context context) throws JSONException {
        JSONArray current = loadScheduled(context);
        JSONArray keep = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < current.length(); i++) {
            JSONObject entry = current.getJSONObject(i);
            long atMs = entry.getLong("atMs");
            if (atMs <= now) {
                continue;
            }
            setAlarm(context, entry.getInt("id"), entry.getString("title"), entry.optString("body", ""),
                    entry.isNull("payload") ? null : entry.getString("payload"), atMs);
            keep.put(entry);
        }
        prefs(context).edit().putString(KEY_SCHEDULED, keep.toString()).apply();
        Log.d(TAG, "rescheduled " + keep.length() + " notification(s)");
    }
}
