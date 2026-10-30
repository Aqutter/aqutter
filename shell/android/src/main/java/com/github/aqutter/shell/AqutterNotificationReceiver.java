package com.github.aqutter.shell;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** 排程的時間到了：顯示通知，並把它從保存的排程中移除。 */
public class AqutterNotificationReceiver extends BroadcastReceiver {
    private static final String TAG = "AqutterNotify";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!intent.hasExtra(AqutterNotifications.EXTRA_ID)) {
            Log.w(TAG, "alarm without an id, ignored");
            return;
        }
        int id = intent.getIntExtra(AqutterNotifications.EXTRA_ID, 0);
        Log.d(TAG, "alarm fired id=" + id);
        try {
            AqutterNotifications.post(
                    context,
                    id,
                    intent.getStringExtra(AqutterNotifications.EXTRA_TITLE),
                    intent.getStringExtra(AqutterNotifications.EXTRA_BODY),
                    intent.getStringExtra(AqutterNotifications.EXTRA_PAYLOAD));
            AqutterNotifications.removeScheduled(context, id);
        } catch (Exception error) {
            Log.e(TAG, "could not show the scheduled notification id=" + id, error);
        }
    }
}
