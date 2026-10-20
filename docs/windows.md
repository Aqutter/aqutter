# Windows 佈線

`aqutter init` 的範本已含 `windows/`（CMake + Win32 runner）。Windows 桌面**沒有 App Sandbox / entitlements / ATS**，loopback http 直接可用，佈線比 macOS 單純；主要差異在 WebView2 runtime 與少數平台能力限制。

## 0. 建置前置需求（Windows toolchain）

- **Visual Studio 2022**（含「Desktop development with C++」workload）與 CMake — `flutter doctor` 的 Windows toolchain 需通過。
- **NuGet CLI（`nuget.exe`）必須在 PATH**（關鍵）。`aqutter_core` 的 Windows CMake 步驟以 `nuget` 下載原生相依（`nlohmann.json`、WebView2 SDK）；PATH 上沒有 `nuget.exe` 時建置會失敗並顯示 `NUGET-NOTFOUND` / 返回碼 9009（`dotnet` CLI 內建的 `dotnet nuget` **不算**，plugin 找的是獨立執行檔）。
  - 安裝：下載官方 <https://dist.nuget.org/win-x86-commandline/latest/nuget.exe>（約 7 MB），放到一個已在 PATH 的資料夾（或新增其所在資料夾到使用者 PATH），開新終端機後 `nuget help` 可驗證。
- 首次 `flutter build windows` 會經上述 NuGet 抓取原生 SDK，需網路。
- **第一次先在 `aqutter/` 執行 `flutter pub get`**，再跑 `aqutter dev windows`。dev 時網頁字型由殼的套件目錄供應，沒有先 `pub get` 會看到「找不到殼套件的字型目錄」警告，且 Windows plugin 的原生資訊（`.flutter-plugins-dependencies`）也還不存在。
- 預設 dev 埠（3000）若已被別的程式占用，`aqutter dev` 會中止並提示改用 `--port=<n>`。

## 1. WebView2 Runtime

`aqutter_core` 在 Windows 走 **Microsoft Edge WebView2**。

- **Windows 11 已內建** Evergreen WebView2 Runtime，開發與多數目標機免安裝。
- 舊版 Windows 10 若缺 runtime，App 會白畫面／WebView 無法建立。發佈時可隨附 **Evergreen Bootstrapper**（`MicrosoftEdgeWebview2Setup.exe`）或走 offline installer，見 <https://developer.microsoft.com/microsoft-edge/webview2/>。

## 2. Loopback / cleartext（無需設定）

內嵌 shelf server 綁 `127.0.0.1:<隨機port>`，WebView2 載入 `http://127.0.0.1` 無沙盒限制，**不需**任何 ATS / capability 宣告（對比 macOS 的 `NSAllowsLocalNetworking` + `network.server` entitlement）。`lib/main.dart` 的 `InAppWebViewSettings.useHybridComposition` / `mixedContentMode` 為 Android 專屬欄位，在 Windows 被忽略、不影響行為。

## 3. 權限（permission_plus 於 Windows 的模型）

Windows 桌面（Win32）app 沒有行動端那種逐 app 的權限對話框，`permission_plus_windows` 的行為如下（出自該套件 README）：

- 相機、麥克風、定位、藍牙：以 WinRT 查詢，回傳**實際狀態**（取決於「設定 > 隱私權與安全性」的「允許桌面應用程式存取」開關）；`requestPermission` 只檢查目前狀態，**不會**跳系統彈窗。
- 通知、相簿／影片／音訊、儲存空間、通訊錄、行事曆、感測器、電話／簡訊等：一律回 `granted`。
- `openSettings()` 開啟系統設定頁。

前端呼叫不會壞，但**不應假設**其語意與行動端一致（尤其 `request` 不會讓使用者有機會授權）。

## 4. In-App Browser（平台差異）

`AqutterChromeSafariBrowser`（`iab_open`）為 **iOS/Android 專屬**，Windows 無對應實作，呼叫時可能拋錯。桌面情境建議前端改走 `opener_open`（`url_launcher`）以外部瀏覽器開啟，或改用 `aqutter_core` 的一般視窗（與 `macos.md` 同註記）。

## 5. 視窗標題 / 尺寸（選配）

- 初始視窗標題：`windows/runner/main.cpp` 的 `window.Create(L"<appName>", ...)`。
- 初始尺寸：同檔的 `Win32Window::Point origin` / `Size size`（預設 1280×720）。
- App 顯示名 / 版權：`windows/runner/Runner.rc`。

本專案預設值可直接使用；如需自訂再改上述檔案。

## 6. 最小化（`minimize_app`）

桌面既有 `minimize_app` handler 已以 try/catch 安全 no-op（`bridge_registry.dart`），Windows 維持不變。若日後要實作視窗最小化，可於 runner 註冊 `app/host` MethodChannel 呼叫 Win32 `ShowWindow(hwnd, SW_MINIMIZE)`。本期未實作。

## 7. 建置 / 簽章

```bash
aqutter seed                 # 產生 <appDir>/assets/seed/web-bundle.zip（網頁框架靜態輸出）
aqutter build windows        # 或 aqutter dev windows
```

產物：`build/windows/x64/runner/Release/`（含 `<appName>.exe` + DLL + `data/`）。整個 `Release/` 目錄需一起散佈。

## 8. 疑難排解

| 現象 | 原因與處理 |
| :--- | :--- |
| `flutter pub get` 報「aqutter from git doesn't support null safety」「sdk: '<2.0.0'」 | 非 UTF-8 的 Windows（例如繁中 cp950）上，pub 以系統碼頁讀取 git 依賴的 `pubspec.yaml`；其中的中文註解被誤解碼並吃掉換行，`sdk:` 設定因此消失。**git 依賴（`shell/`、`aqutter_core`）的 `pubspec.yaml` 必須保持純 ASCII**。臨時解法：Windows「設定 > 時間與語言 > 語言與區域 > 系統管理語言設定」勾選「Beta：使用 Unicode UTF-8 提供全球語言支援」並重開機。 |
| CMake 報 `Unknown CMake command "aqutter_core_apply_standard_settings"` | `pubspec.lock` 鎖在舊 commit。開發階段 `shell`、`aqutter_core` 共用的 `0.0.0` tag 會隨 `main` 移動，lock 會過期：在 `aqutter/` 執行 `flutter pub upgrade aqutter aqutter_core` 後重建。 |
| 安裝階段報 `file cannot create directory: C:/Program Files/<appName>` 或編譯報 `C1041`（PDB 被占用） | 先前被中斷的建置留下了錯誤的 CMake 快取或殘留的 `cl.exe` / `MSBuild`。結束殘留程序後刪除 `aqutter/build/windows` 重建。 |

**Code signing（選配）**：Windows 以 Authenticode 對 `.exe` 簽章（`signtool sign /fd SHA256 /a <appName>.exe`，需 EV/OV 憑證），非建置必要步驟，發佈給外部使用者時再處理。企業散佈亦可打包為 MSIX（`msix` 套件）另行評估。亦可用 `aqutter build --signing=…` 自動簽章，見 [build-and-signing.md](build-and-signing.md)。
