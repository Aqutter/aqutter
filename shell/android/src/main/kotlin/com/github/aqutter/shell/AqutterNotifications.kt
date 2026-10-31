package com.github.aqutter.shell

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry
import org.json.JSONArray
import org.json.JSONObject

/**
 * 殼套件自己的本機通知（Android）。
 *
 * Dart 端的約定見 shell/lib/src/bridge/notification_service.dart 的 PlatformLocalNotifier：
 *   initialize / show / schedule / cancel / cancelAll / launchedBy（Dart → 原生）
 *   tapped（原生 → Dart，App 執行中使用者點了通知）
 *
 * 排程用 AlarmManager.setAndAllowWhileIdle（不需要精確鬧鐘權限，系統可能延後數分鐘），時間到由
 * [AqutterNotificationReceiver] 顯示；尚未到時間的排程存在 SharedPreferences，裝置重新開機或 App 更新後
 * 由 [AqutterBootReceiver] 重新排上（已過時間的不補發）。
 */
internal class AqutterNotifications(
    context: Context,
    private val channel: MethodChannel,
) : MethodChannel.MethodCallHandler, PluginRegistry.NewIntentListener {
    private val context: Context = context.applicationContext

    /** 由通知冷啟 App 時的資訊；同一個程序內重複讀取回傳相同值。 */
    private var launch: Map<String, Any?>? = null

    /** Dart 端已呼叫過 initialize：此後的點擊以事件送給 Dart，之前的點擊視為「點通知而冷啟」。 */
    private var dartReady = false

    init {
        channel.setMethodCallHandler(this)
    }

    fun detach() {
        channel.setMethodCallHandler(null)
    }

    // ---- Activity：冷啟與執行中的點擊 ----

    fun onActivityAttached(activity: Activity) {
        val info = readTap(activity.intent)
        if (info != null && launch == null) {
            launch = info
        }
    }

    override fun onNewIntent(intent: Intent): Boolean {
        val info = readTap(intent) ?: return false
        intent.removeExtra(EXTRA_ID)
        intent.removeExtra(EXTRA_PAYLOAD)
        if (dartReady) {
            channel.invokeMethod("tapped", info)
        } else if (launch == null) {
            // App 的程序被殺掉後點通知：系統先用原本的啟動 Intent 重建 Activity，再以 onNewIntent 送來
            // 點擊的 Intent，這時 Dart 還沒就緒，事件會被丟棄；記成冷啟資訊，等網頁用 launchedBy 取走
            launch = info
        }
        return true
    }

    // ---- Dart 端的呼叫 ----

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "initialize" -> {
                    ensureChannel(context)
                    dartReady = true
                    result.success(null)
                }
                "show" -> {
                    post(context, id(call), call.argument("title"), call.argument("body"), call.argument("payload"))
                    result.success(null)
                }
                "schedule" -> {
                    schedule(
                        context, id(call), call.argument("title"), call.argument("body"),
                        call.argument("payload"), longArgument(call, "atMs"),
                    )
                    result.success(null)
                }
                "cancel" -> {
                    cancel(context, id(call))
                    result.success(null)
                }
                "cancelAll" -> {
                    cancelAll(context)
                    result.success(null)
                }
                "launchedBy" -> result.success(launch)
                else -> result.notImplemented()
            }
        } catch (error: Exception) {
            Log.e(TAG, "${call.method} failed", error)
            result.error("notification_failed", error.message, null)
        }
    }

    private fun id(call: MethodCall): Int =
        call.argument<Int>("id") ?: throw IllegalArgumentException("id is required")

    private fun longArgument(call: MethodCall, key: String): Long =
        call.argument<Number>(key)?.toLong() ?: throw IllegalArgumentException("$key is required")

    companion object {
        const val CHANNEL = "com.github.aqutter/notifications"
        const val CHANNEL_ID = "aqutter_default"
        const val CHANNEL_NAME = "通知"

        const val EXTRA_ID = "com.github.aqutter.notification.id"
        const val EXTRA_TITLE = "com.github.aqutter.notification.title"
        const val EXTRA_BODY = "com.github.aqutter.notification.body"
        const val EXTRA_PAYLOAD = "com.github.aqutter.notification.payload"

        private const val TAG = "AqutterNotify"
        private const val PREFS = "com.github.aqutter.notifications"
        private const val KEY_SCHEDULED = "scheduled"

        private fun readTap(intent: Intent?): Map<String, Any?>? {
            if (intent == null || !intent.hasExtra(EXTRA_ID)) {
                return null
            }
            return mapOf(
                "id" to intent.getIntExtra(EXTRA_ID, 0),
                "payload" to intent.getStringExtra(EXTRA_PAYLOAD),
            )
        }

        // ---- 顯示 ----

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT),
                )
            }
        }

        /** 立即顯示；點通知會開啟 App 並帶 id 與 payload。沒有通知權限時系統會直接丟掉，Dart 端已先檢查。 */
        fun post(context: Context, id: Int, title: String?, body: String?, payload: String?) {
            ensureChannel(context)
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: throw IllegalStateException("no launch intent for ${context.packageName}")
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            launch.putExtra(EXTRA_ID, id)
            launch.putExtra(EXTRA_PAYLOAD, payload)
            val tap = PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(context.applicationInfo.icon)
                .setContentTitle(title)
                .setContentText(body ?: "")
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            try {
                NotificationManagerCompat.from(context).notify(id, builder.build())
                Log.d(TAG, "posted id=$id")
            } catch (error: SecurityException) {
                Log.w(TAG, "notification permission missing, dropped id=$id", error)
            }
        }

        // ---- 排程 ----

        private fun alarmIntent(context: Context, id: Int, title: String?, body: String?, payload: String?, flags: Int): PendingIntent? {
            val intent = Intent(context, AqutterNotificationReceiver::class.java)
            intent.putExtra(EXTRA_ID, id)
            intent.putExtra(EXTRA_TITLE, title)
            intent.putExtra(EXTRA_BODY, body)
            intent.putExtra(EXTRA_PAYLOAD, payload)
            return PendingIntent.getBroadcast(context, id, intent, flags or PendingIntent.FLAG_IMMUTABLE)
        }

        fun schedule(context: Context, id: Int, title: String?, body: String?, payload: String?, atMs: Long) {
            saveScheduled(context, id, title, body, payload, atMs)
            setAlarm(context, id, title, body, payload, atMs)
            Log.d(TAG, "scheduled id=$id at=$atMs in ${atMs - System.currentTimeMillis()} ms")
        }

        fun setAlarm(context: Context, id: Int, title: String?, body: String?, payload: String?, atMs: Long) {
            val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pending = alarmIntent(context, id, title, body, payload, PendingIntent.FLAG_UPDATE_CURRENT)
                ?: throw IllegalStateException("could not create the alarm intent for id=$id")
            // 不需要精確鬧鐘權限；系統可能延後數分鐘（契約 §5）
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pending)
        }

        fun cancel(context: Context, id: Int) {
            cancelAlarm(context, id)
            removeScheduled(context, id)
            NotificationManagerCompat.from(context).cancel(id)
        }

        fun cancelAll(context: Context) {
            val scheduled = loadScheduled(context)
            for (i in 0 until scheduled.length()) {
                cancelAlarm(context, scheduled.getJSONObject(i).getInt("id"))
            }
            prefs(context).edit().remove(KEY_SCHEDULED).apply()
            NotificationManagerCompat.from(context).cancelAll()
        }

        private fun cancelAlarm(context: Context, id: Int) {
            val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val existing = alarmIntent(context, id, null, null, null, PendingIntent.FLAG_NO_CREATE)
            if (existing != null) {
                alarms.cancel(existing)
                existing.cancel()
            }
        }

        // ---- 排程的保存（重開機後重新排程用） ----

        private fun prefs(context: Context): SharedPreferences =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        @Synchronized
        private fun loadScheduled(context: Context): JSONArray {
            val raw = prefs(context).getString(KEY_SCHEDULED, null) ?: return JSONArray()
            return try {
                JSONArray(raw)
            } catch (error: org.json.JSONException) {
                JSONArray()
            }
        }

        /** 排程清單中去掉 [id] 的其餘項目。 */
        private fun withoutId(current: JSONArray, id: Int): JSONArray {
            val next = JSONArray()
            for (i in 0 until current.length()) {
                if (current.getJSONObject(i).getInt("id") != id) {
                    next.put(current.getJSONObject(i))
                }
            }
            return next
        }

        @Synchronized
        private fun saveScheduled(context: Context, id: Int, title: String?, body: String?, payload: String?, atMs: Long) {
            val next = withoutId(loadScheduled(context), id)
            val entry = JSONObject()
            entry.put("id", id)
            entry.put("title", title)
            entry.put("body", body)
            entry.put("payload", payload)
            entry.put("atMs", atMs)
            next.put(entry)
            prefs(context).edit().putString(KEY_SCHEDULED, next.toString()).apply()
        }

        @Synchronized
        fun removeScheduled(context: Context, id: Int) {
            val next = withoutId(loadScheduled(context), id)
            prefs(context).edit().putString(KEY_SCHEDULED, next.toString()).apply()
        }

        /** 重開機或 App 更新後重新排上尚未到時間的通知；已過時間的丟掉，不補發。 */
        @Synchronized
        fun rescheduleAll(context: Context) {
            val current = loadScheduled(context)
            val keep = JSONArray()
            val now = System.currentTimeMillis()
            for (i in 0 until current.length()) {
                val entry = current.getJSONObject(i)
                val atMs = entry.getLong("atMs")
                if (atMs <= now) {
                    continue
                }
                setAlarm(
                    context, entry.getInt("id"), entry.getString("title"), entry.optString("body", ""),
                    if (entry.isNull("payload")) null else entry.getString("payload"), atMs,
                )
                keep.put(entry)
            }
            prefs(context).edit().putString(KEY_SCHEDULED, keep.toString()).apply()
            Log.d(TAG, "rescheduled ${keep.length()} notification(s)")
        }
    }
}
