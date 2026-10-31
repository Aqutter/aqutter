package com.github.aqutter.shell

import com.github.aqutter.shell.clipboard.AqutterClipboard
import com.github.aqutter.shell.notification.AqutterNotifications
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodChannel

/**
 * 殼套件自己的 Android 原生部分的入口：把註冊分給各功能。
 *   clipboard/    圖片剪貼簿
 *   notification/ 本機通知（點通知的 Intent 需要 Activity，所以也實作 ActivityAware）
 */
class AqutterShellPlugin : FlutterPlugin, ActivityAware {
    private var clipboard: AqutterClipboard? = null
    private var notifications: AqutterNotifications? = null
    private var activityBinding: ActivityPluginBinding? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        val context = binding.applicationContext
        clipboard = AqutterClipboard(context, MethodChannel(binding.binaryMessenger, AqutterClipboard.CHANNEL))
        notifications = AqutterNotifications(context, MethodChannel(binding.binaryMessenger, AqutterNotifications.CHANNEL))
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        clipboard?.detach()
        clipboard = null
        notifications?.detach()
        notifications = null
    }

    // ---- ActivityAware：點通知時的 Intent（冷啟與執行中） ----

    override fun onAttachedToActivity(binding: ActivityPluginBinding) = attach(binding)

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) = attach(binding)

    override fun onDetachedFromActivityForConfigChanges() = detach()

    override fun onDetachedFromActivity() = detach()

    private fun attach(binding: ActivityPluginBinding) {
        activityBinding = binding
        notifications?.let {
            it.onActivityAttached(binding.activity)
            binding.addOnNewIntentListener(it)
        }
    }

    private fun detach() {
        val binding = activityBinding
        val listener = notifications
        if (binding != null && listener != null) {
            binding.removeOnNewIntentListener(listener)
        }
        activityBinding = null
    }
}
