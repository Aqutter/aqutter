package com.github.aqutter.shell;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** 裝置重新開機或 App 更新後，系統會清掉鬧鐘：把尚未到時間的排程通知重新排上。 */
public class AqutterBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }
        try {
            AqutterNotifications.rescheduleAll(context);
        } catch (Exception error) {
            Log.e("AqutterNotify", "could not reschedule after " + action, error);
        }
    }
}
