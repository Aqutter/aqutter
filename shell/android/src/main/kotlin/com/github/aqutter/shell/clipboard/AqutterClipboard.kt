package com.github.aqutter.shell.clipboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.util.concurrent.Executors

/**
 * 殼套件自己的圖片剪貼簿（Android）。
 *
 * Dart 端的約定見 shell/lib/src/plugins/clipboard/clipboard_image_service.dart：
 *   readImage  → 剪貼簿裡的圖片（PNG 位元組），沒有圖片回 null
 *   writeImage → { data: bytes, format: "png" | "jpeg" }，放進剪貼簿
 */
internal class AqutterClipboard(
    context: Context,
    private val channel: MethodChannel,
) : MethodChannel.MethodCallHandler {
    private val context: Context = context.applicationContext
    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    init {
        channel.setMethodCallHandler(this)
    }

    fun detach() {
        channel.setMethodCallHandler(null)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "readImage" -> readImage(result)
            "writeImage" -> writeImage(call.argument<ByteArray>("data"), call.argument<String>("format"), result)
            else -> result.notImplemented()
        }
    }

    private fun readImage(result: MethodChannel.Result) {
        io.execute {
            try {
                val png = readPngFromClipboard(context)
                main.post { result.success(png) }
            } catch (error: Exception) {
                main.post { result.error("clipboard_read_failed", error.message, null) }
            }
        }
    }

    private fun writeImage(data: ByteArray?, format: String?, result: MethodChannel.Result) {
        if (data == null) {
            result.error("invalid_argument", "data is required", null)
            return
        }
        val extension = if (format == "jpeg") "jpg" else "png"
        io.execute {
            try {
                val dir = File(context.cacheDir, CACHE_DIR)
                if (!dir.exists() && !dir.mkdirs()) {
                    throw IOException("cannot create $dir")
                }
                // 只留最新一張：舊檔可能還被某個 App 的貼上動作引用，但留著只會讓快取越積越多
                dir.listFiles()?.forEach { it.delete() }
                val file = File(dir, "clipboard.$extension")
                file.outputStream().use { it.write(data) }
                val uri = FileProvider.getUriForFile(context, context.packageName + ".aqutter.clipboard", file)
                val clip = ClipData.newUri(context.contentResolver, "image", uri)
                main.post {
                    try {
                        val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        manager.setPrimaryClip(clip)
                        result.success(null)
                    } catch (error: Exception) {
                        result.error("clipboard_write_failed", error.message, null)
                    }
                }
            } catch (error: Exception) {
                main.post { result.error("clipboard_write_failed", error.message, null) }
            }
        }
    }

    companion object {
        const val CHANNEL = "com.github.aqutter/clipboard"
        private const val CACHE_DIR = "aqutter_clipboard"

        /** 讀取時最多讀到這麼多位元組（5 MiB + 1）；超過的部分不需要，Dart 端看到超過上限就回 too_large。 */
        private const val MAX_READ_BYTES = 5 * 1024 * 1024 + 1

        private fun readPngFromClipboard(context: Context): ByteArray? {
            val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            val clip = manager?.primaryClip
            if (clip == null || clip.itemCount == 0) {
                return null
            }
            val uri = clip.getItemAt(0).uri ?: return null
            val resolver = context.contentResolver
            val type = resolver.getType(uri)
            if (type == null || !type.startsWith("image/")) {
                return null
            }
            if (type == "image/png") {
                return readLimited(resolver, uri)
            }
            // 其他格式（JPEG、WebP…）解碼後轉成 PNG，讓網頁只需要處理一種格式
            return resolver.openInputStream(uri)?.use { stream ->
                val bitmap = BitmapFactory.decodeStream(stream) ?: return@use null
                val out = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                bitmap.recycle()
                out.toByteArray()
            }
        }

        private fun readLimited(resolver: ContentResolver, uri: Uri): ByteArray? {
            return resolver.openInputStream(uri)?.use { stream ->
                val out = ByteArrayOutputStream()
                val buffer = ByteArray(16 * 1024)
                var total = 0
                while (total < MAX_READ_BYTES) {
                    val read = stream.read(buffer, 0, minOf(buffer.size, MAX_READ_BYTES - total))
                    if (read == -1) {
                        break
                    }
                    out.write(buffer, 0, read)
                    total += read
                }
                out.toByteArray()
            }
        }
    }
}
