package {{orgId}}.{{appName}}

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {

    /** 宿主通道；除 Dart→原生的呼叫外，功能鍵亦由此反向 invoke 回 Dart。 */
    private var hostChannel: MethodChannel? = null

    /**
     * 網頁層要求的系統列狀態。隱藏是「一次性的請求」而非持久設定，系統會在許多時機自行還原
     * （軟鍵盤彈出、通知欄下拉、系統對話框關閉、鎖屏解鎖），因此必須記住意圖並在還原後重貼。
     */
    private var systemBarsHidden = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyDisplayCutoutMode()
        keepSystemBarsHidden()
    }

    /**
     * 視窗重新取得焦點時重貼系統列。
     *
     * 涵蓋通知欄收起、系統對話框（權限詢問）關閉、鎖屏解鎖——這些都會讓系統還原系統列，
     * 但都不會觸發 `onStart`，所以生命週期回呼救不了，必須掛在焦點變化上。
     */
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            reassertSystemBarsHidden()
        }
    }

    /**
     * Activity 重建（configChanges 未涵蓋的變更、或系統回收後重啟）後首次 resume 也要重貼：
     * 網頁層此時不會重新掛載、不會再送一次 `system_bars_hide`，意圖只剩本類別記得。
     */
    override fun onResume() {
        super.onResume()
        reassertSystemBarsHidden()
    }

    /**
     * 把重貼延後到下一輪 view tree 事件之後，而不是在回呼當下同步執行。
     *
     * 焦點／生命週期事件是先派給 Activity、再往 view tree 往下傳：同步重貼的話，
     * 緊接著 `FlutterView` 會收到同一個事件並重貼 Flutter 端記住的 `SystemUiMode.edgeToEdge`，
     * 把狀態列叫回來，蓋掉我們剛貼的隱藏。`post` 讓重貼落在整輪派送（含 FlutterView 那一次）
     * 之後，成為最後一個說話的人。
     *
     * `post` 內再檢查一次 `systemBarsHidden`：排隊期間網頁可能已改送 show，不能拿舊意圖覆蓋。
     */
    private fun reassertSystemBarsHidden() {
        if (!systemBarsHidden) {
            return
        }
        window.decorView.post {
            if (systemBarsHidden) {
                setSystemBarsVisible(false)
            }
        }
    }

    /**
     * 插邊變化時重貼系統列，補上 [onWindowFocusChanged] 涵蓋不到的一種：**軟鍵盤**。
     *
     * IME 顯示不會改變視窗焦點（IME 視窗本身不取得焦點），卻會讓系統把系統列一併還原，
     * 於是打字時狀態列就跑回來了。插邊變化是唯一會在該時機發出的訊號。
     *
     * 只觀察不吃掉：務必以 `ViewCompat.onApplyWindowInsets` 交還預設處理，否則插邊不會再
     * 往下傳給 FlutterView，Dart 端的 SafeAreaInjector 就拿不到 `--safe-area-*`。
     * 重貼會再觸發一次插邊變化，但那時 statusBars 已不可見，條件不成立故不會遞迴。
     */
    private fun keepSystemBarsHidden() {
        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { view, insets ->
            if (systemBarsHidden && insets.isVisible(WindowInsetsCompat.Type.statusBars())) {
                setSystemBarsVisible(false)
            }
            ViewCompat.onApplyWindowInsets(view, insets)
        }
    }

    /**
     * 功能鍵攔截：正規化為平台無關的 AppKey 後上報前端，由網頁層的註冊表決定誰消耗。
     *
     * 刻意攔在 `dispatchKeyEvent` 而非 `onKeyDown`——這是本類別最關鍵的一行位置：
     * `Activity.dispatchKeyEvent` 會先呼叫 `window.superDispatchKeyEvent()`（view 階層），
     * 只有在 view 未消耗時才輪到 `onKeyDown`。WebView 平時對功能鍵沒有處理故會放行，
     * 攔在 onKeyDown 看似可行；但**只要網頁有輸入框取得焦點（軟鍵盤彈出），WebView 就會
     * 吃掉按鍵並回傳 true**，onKeyDown 從此不再被呼叫，硬體鍵整個失效。在 super 之前處理
     * 即先於 view 階層，與焦點狀態無關，且 WebView 不會再收到同一顆鍵的 DOM keydown，
     * 網頁層因此不需要去重。
     *
     * 非功能鍵一律交給 super：掃描槍打的是可見字元，必須照常流進 WebView 由網頁層偵測。
     *
     * BACK 不在此處理，維持由 Flutter 的 PopScope 派送（手勢返回也走該路徑）。
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val appKey = FUNCTION_KEYS[event.keyCode] ?: return super.dispatchKeyEvent(event)

        // 只在首次按下時上報；ACTION_UP 與長按 repeat 一併吞掉，避免重複觸發
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            hostChannel?.invokeMethod(
                METHOD_HARDWARE_KEY,
                // 一併帶原始 keyCode：前端多數情況只需 key，但需分辨「實體 F1」與
                // 「被機型重映射過來的鍵」時可用（本表可能把音量碼映射成 F1/F2）。
                mapOf("key" to appKey, "nativeKeyCode" to event.keyCode),
            )
        }
        return true
    }

    /**
     * 允許視窗延伸進 display cutout（瀏海 / 挖孔）區域。
     *
     * 預設的 `LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT` 只在系統列存在時放行；系統列一旦隱藏，
     * 視窗就被排除在 cutout 之外，系統會以**黑色 letterbox** 填滿那一條。該色塊由系統繪製，
     * 與 app 主題無關，所以淺色與深色模式看起來都是黑的。
     *
     * `ALWAYS` 需 API 30；28/29 退回 `SHORT_EDGES`——後者在橫向時 cutout 落在長邊仍會被避開，
     * 屬那兩個版本的限制。
     */
    private fun applyDisplayCutoutMode() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            return
        }
        val cutoutMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        }
        else {
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        window.attributes = window.attributes.apply { layoutInDisplayCutoutMode = cutoutMode }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // 對映 Dart 端 bridge_names.dart 的 HostMethod（`app/host` channel）
        val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, AQUTTER_CHANNEL)
        hostChannel = channel
        channel.setMethodCallHandler { call, result ->
                when (call.method) {
                    METHOD_MINIMIZE -> {
                        moveTaskToBack(true)
                        result.success(null)
                    }
                    METHOD_SYSTEM_BARS_HIDE -> {
                        setSystemBarsVisible(false)
                        result.success(null)
                    }
                    METHOD_SYSTEM_BARS_SHOW -> {
                        setSystemBarsVisible(true)
                        result.success(null)
                    }
                    METHOD_INSTALL_APK -> {
                        val path = call.argument<String>("path")
                        if (path == null) {
                            result.error("bad_args", "path is required", null)
                            return@setMethodCallHandler
                        }
                        try {
                            installApk(File(path))
                            result.success(null)
                        } catch (e: Exception) {
                            result.error("install_failed", e.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    /**
     * 以 FileProvider 的 content:// 把已下載的 APK 交給系統安裝器。
     *
     * 「安裝未知來源」未授權時刻意不自行導去設定頁：API 26+ 的系統安裝器會自己引導，
     * 那是標準路徑，重做一份只多一個維護點。使用者取消後回到 App，Dart 端的阻擋畫面
     * 仍在，再按一次即重新喚起。
     */
    private fun installApk(file: File) {
        require(file.exists()) { "APK not found: ${file.path}" }
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(intent)
    }

    /**
     * 顯示 / 隱藏系統列（狀態列 + 導航列），且全程維持 edge-to-edge。
     *
     * 刻意不走 Flutter 的 `SystemChrome.setEnabledSystemUIMode`：engine 對任何非 edgeToEdge 的
     * mode 都會先執行 `WindowCompat.setDecorFitsSystemWindows(window, true)`，視窗重新被系統列
     * 插邊內縮，WebView 畫不到那塊，露出 Activity 的 windowBackground 形成色帶（深色主題即黑帶）。
     * 且 legacy 的 `View.SYSTEM_UI_FLAG_*` 自 targetSdk 35 起會被系統忽略，該路徑已非受支援做法。
     */
    private fun setSystemBarsVisible(visible: Boolean) {
        // 記住意圖，供 reassertSystemBarsHidden / keepSystemBarsHidden 在系統擅自還原後重貼
        systemBarsHidden = !visible
        // 每次都重申 edge-to-edge，確保沒有任何路徑殘留 decorFitsSystemWindows = true
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        if (visible) {
            controller.show(WindowInsetsCompat.Type.systemBars())
            return
        }
        // 保留原 immersiveSticky 語意：邊緣滑動可暫時喚出，且暫時喚出期間 inset 仍為 0，版面不會跳動
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        // API < 30 的 hide() 只是把 legacy SYSTEM_UI_FLAG_* 或進 decorView 既有旗標：
        // 旗標值沒變時 View.setSystemUiVisibility 視為 no-op，WindowManager 不會重新套用，
        // 於是「旗標說已隱藏、狀態列卻還在」。先 show 一次讓值確實變動，hide 才會真的落地。
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
        controller.hide(WindowInsetsCompat.Type.systemBars())
    }

    private companion object {
        const val AQUTTER_CHANNEL = "app/host"
        const val METHOD_MINIMIZE = "minimize"
        const val METHOD_SYSTEM_BARS_HIDE = "system_bars_hide"
        const val METHOD_SYSTEM_BARS_SHOW = "system_bars_show"
        const val METHOD_INSTALL_APK = "install_apk"
        const val METHOD_HARDWARE_KEY = "hardware_key"

        /**
         * Android keyCode → 網頁層的 `AppKey` 值（見 packages/aqutter/src/contract/models/key.ts）。
         *
         * 此表即「本機的按鍵長什麼樣」的唯一宣告處，工業機／POS 的怪癖在此吸收，
         * 網頁層只認得正規化後的 AppKey。例如某些工業機沒有音量鍵，兩顆功能鍵
         * 直接沿用了音量的 scancode（以 `adb shell getevent -l` 側錄可確認），
         * 這種機型只需在此加上：
         *
         * ```kotlin
         * KeyEvent.KEYCODE_VOLUME_UP to "F1",
         * KeyEvent.KEYCODE_VOLUME_DOWN to "F2",
         * ```
         *
         * 注意：列在此表的鍵一律被吞掉不再往下傳，故加入音量鍵等系統鍵時，
         * 該鍵的原本功能（調整音量）也會一併失效——對功能鍵取向的機種是預期行為。
         */
        val FUNCTION_KEYS: Map<Int, String> = mapOf(
            KeyEvent.KEYCODE_F1 to "F1",
            KeyEvent.KEYCODE_F2 to "F2",
            KeyEvent.KEYCODE_F3 to "F3",
            KeyEvent.KEYCODE_F4 to "F4",
        )
    }
}
