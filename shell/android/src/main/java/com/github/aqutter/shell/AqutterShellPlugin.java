package com.github.aqutter.shell;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * 殼套件自己的 Android 原生部分：圖片剪貼簿。
 *
 * Dart 端的約定見 shell/lib/src/bridge/clipboard_image_service.dart：
 *   readImage  → 剪貼簿裡的圖片（PNG 位元組），沒有圖片回 null
 *   writeImage → { data: bytes, format: "png" | "jpeg" }，放進剪貼簿
 */
public class AqutterShellPlugin implements FlutterPlugin, MethodChannel.MethodCallHandler {
    private static final String CHANNEL = "com.github.aqutter/clipboard";
    private static final String CACHE_DIR = "aqutter_clipboard";

    /** 讀取時最多讀到這麼多位元組（5 MiB + 1）；超過的部分不需要，Dart 端看到超過上限就回 too_large。 */
    private static final int MAX_READ_BYTES = 5 * 1024 * 1024 + 1;

    private Context context;
    private MethodChannel channel;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        context = binding.getApplicationContext();
        channel = new MethodChannel(binding.getBinaryMessenger(), CHANNEL);
        channel.setMethodCallHandler(this);
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        channel.setMethodCallHandler(null);
        channel = null;
        context = null;
    }

    @Override
    public void onMethodCall(@NonNull MethodCall call, @NonNull MethodChannel.Result result) {
        switch (call.method) {
            case "readImage":
                readImage(result);
                break;
            case "writeImage":
                writeImage(call.<byte[]>argument("data"), call.<String>argument("format"), result);
                break;
            default:
                result.notImplemented();
        }
    }

    private void readImage(MethodChannel.Result result) {
        final Context appContext = context;
        io.execute(() -> {
            try {
                final byte[] png = readPngFromClipboard(appContext);
                main.post(() -> result.success(png));
            } catch (Exception error) {
                main.post(() -> result.error("clipboard_read_failed", error.getMessage(), null));
            }
        });
    }

    private static byte[] readPngFromClipboard(Context context) throws IOException {
        ClipboardManager manager = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = manager == null ? null : manager.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0) {
            return null;
        }
        Uri uri = clip.getItemAt(0).getUri();
        if (uri == null) {
            return null;
        }
        ContentResolver resolver = context.getContentResolver();
        String type = resolver.getType(uri);
        if (type == null || !type.startsWith("image/")) {
            return null;
        }
        if (type.equals("image/png")) {
            return readLimited(resolver, uri);
        }
        // 其他格式（JPEG、WebP…）解碼後轉成 PNG，讓網頁只需要處理一種格式
        try (InputStream stream = resolver.openInputStream(uri)) {
            if (stream == null) {
                return null;
            }
            Bitmap bitmap = BitmapFactory.decodeStream(stream);
            if (bitmap == null) {
                return null;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            bitmap.recycle();
            return out.toByteArray();
        }
    }

    private static byte[] readLimited(ContentResolver resolver, Uri uri) throws IOException {
        try (InputStream stream = resolver.openInputStream(uri)) {
            if (stream == null) {
                return null;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int read;
            while (total < MAX_READ_BYTES && (read = stream.read(buffer, 0, Math.min(buffer.length, MAX_READ_BYTES - total))) != -1) {
                out.write(buffer, 0, read);
                total += read;
            }
            return out.toByteArray();
        }
    }

    private void writeImage(byte[] data, String format, MethodChannel.Result result) {
        if (data == null) {
            result.error("invalid_argument", "data is required", null);
            return;
        }
        final Context appContext = context;
        final String extension = "jpeg".equals(format) ? "jpg" : "png";
        io.execute(() -> {
            try {
                File dir = new File(appContext.getCacheDir(), CACHE_DIR);
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IOException("cannot create " + dir);
                }
                // 只留最新一張：舊檔可能還被某個 App 的貼上動作引用，但留著只會讓快取越積越多
                File[] old = dir.listFiles();
                if (old != null) {
                    for (File file : old) {
                        //noinspection ResultOfMethodCallIgnored
                        file.delete();
                    }
                }
                File file = new File(dir, "clipboard." + extension);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(data);
                }
                Uri uri = FileProvider.getUriForFile(appContext, appContext.getPackageName() + ".aqutter.clipboard", file);
                final ClipData clip = ClipData.newUri(appContext.getContentResolver(), "image", uri);
                main.post(() -> {
                    try {
                        ClipboardManager manager = (ClipboardManager) appContext.getSystemService(Context.CLIPBOARD_SERVICE);
                        manager.setPrimaryClip(clip);
                        result.success(null);
                    } catch (Exception error) {
                        result.error("clipboard_write_failed", error.getMessage(), null);
                    }
                });
            } catch (Exception error) {
                main.post(() -> result.error("clipboard_write_failed", error.getMessage(), null));
            }
        });
    }
}
