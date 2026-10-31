package com.github.aqutter.shell

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** 裝置重新開機或 App 更新後，系統會清掉鬧鐘：把尚未到時間的排程通知重新排上。 */
class AqutterBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) {
            return
        }
        try {
            AqutterNotifications.rescheduleAll(context)
        } catch (error: Exception) {
            Log.e("AqutterNotify", "could not reschedule after $action", error)
        }
    }
}
