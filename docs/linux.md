# Linux 佈線

`aqutter init` 的範本已含 `linux/`（GTK + CMake）。Linux 的 WebView 是 `aqutter_core` 的 **WPE WebKit** 後端（離屏渲染成 GPU 紋理再交給 Flutter），和 Windows 一樣由 Flutter 合成，所以 overlay、underlay、native view 鏡像都能用。

> **驗證範圍（2026-10-22）**：Windows 11 上的 **WSL2 + WSLg**，發行版 **Debian 13 (trixie)**，Flutter 3.47.4，`aqutter dev linux`（debug）。WPE 2.48.3，走 `WPEBackend-FDO`（legacy）路徑。
> **未驗證**：實體 Linux 機器、release 版、GPU 加速（WSL 這次是軟體渲染 `llvmpipe`）、X11 原生桌面、Ubuntu（見[第 5 節](#5-ubuntu)）。

## 1. 支援的發行版

WPE WebKit 必須在**建置**與**執行**的機器上都有（App 動態連結 `libwpewebkit-2.0`）。

| 發行版 | WPE 套件 | 狀態 |
|---|---|---|
| Debian 13 (trixie) | `libwpewebkit-2.0-dev` 2.48.3、`libwpe-1.0-dev`、`libwpebackend-fdo-1.0-dev` | **可用**（本文件的驗證對象；`aqutter_core` 的文件也標為已驗證） |
| Ubuntu 22.04 | 只有舊的 `libwpewebkit-1.0-dev`（2.36） | 不支援（舊 API） |
| Ubuntu 24.04 | **沒有**（`apt-get update` 後 `apt-cache` 查不到任何 `libwpewebkit`、`wpebackend-fdo`） | 不能直接 `apt install`，見[第 5 節](#5-ubuntu) |
| Ubuntu 26.04 | 沒有 | 不支援 |

詳細的後端選擇與從原始碼建置 WPE，見 [aqutter_core 的 doc/linux-wpe-backend.md](https://github.com/Aqutter/aqutter_core/blob/main/doc/linux-wpe-backend.md)。

## 2. 建置前置需求

### Flutter 與 Node

- Flutter 3.47.8 以上（Linux 版 SDK），並啟用 Linux 桌面：`flutter config --enable-linux-desktop`。
- **pnpm 11 需要 Node 22.13 以上**。Debian 13 的套件庫只有 Node 20.19，`pnpm install` 會失敗（`No such built-in module: node:sqlite`）。請改裝官方的 Node 22（例如 nodejs.org 的 Linux 壓縮檔，解到使用者目錄即可）。
- 不要用 root 跑 Flutter 與 App：WSLg 的圖形環境（`XDG_RUNTIME_DIR=/mnt/wslg/runtime-dir`）屬於一般使用者，建一個一般使用者（uid 1000）來跑。

### 系統套件（Debian 13）

下列三類是**實測缺了就失敗**的：

| 缺的套件 | 症狀 | 套件 |
|---|---|---|
| `libsecret-1` | `aqutter dev` 的 CMake 步驟報 `The following required packages were not found: libsecret-1`（`flutter_secure_storage` 需要） | `libsecret-1-dev` |
| GStreamer 外掛 | 網頁載入到一半 WPE 的網頁行程**當掉**（log：`GStreamer element appsink not found`、`autoaudiosink not found`、`WebProcess terminated (reason=CRASHED)`），App 卡在載入約 75% | `gstreamer1.0-plugins-base`、`gstreamer1.0-plugins-good`（再加 `-bad`、`-libav`、`-gl`、`-alsa`、`-pulseaudio`） |
| D-Bus session 與 portal | 檔案選取失敗；log 一直出現 `dbus-launch … No such file or directory` | `dbus`、`dbus-x11`、`dbus-user-session`、`xdg-desktop-portal`、`xdg-desktop-portal-gtk` |

> 用 `apt-get install --no-install-recommends` 時，GStreamer 外掛不會被當成相依一起裝進來，這就是上表第二列的成因。

本次實際安裝的完整清單（**未逐一確認每個都必要**）：

```bash
sudo apt-get install -y --no-install-recommends \
  ca-certificates curl git unzip xz-utils zip file \
  build-essential cmake ninja-build pkg-config clang \
  libgtk-3-dev libsecret-1-dev libjsoncpp-dev libx11-dev \
  libwpewebkit-2.0-dev libwpe-1.0-dev libwpebackend-fdo-1.0-dev \
  libglu1-mesa mesa-utils libegl1 libgles2 \
  gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad \
  gstreamer1.0-libav gstreamer1.0-gl gstreamer1.0-alsa gstreamer1.0-pulseaudio \
  dbus dbus-x11 dbus-user-session xdg-desktop-portal xdg-desktop-portal-gtk \
  fonts-noto-core xdg-user-dirs
```

## 3. 執行

```bash
export XDG_CURRENT_DESKTOP=GNOME                  # portal 的 GTK 後端需要
export WEBKIT_GST_DMABUF_SINK_DISABLED=1          # 見下方「影片播放卡死」
cd <專案>
dbus-run-session -- pnpm exec aqutter dev linux --port=4827
```

- 用 `dbus-run-session` 包起來，App 才有 D-Bus session bus（檔案選取走 XDG Desktop Portal）。
- 預設 dev 埠（3000）被占用時，`aqutter dev` 會中止並提示 `--port=<n>`。

## 4. 遇到的問題與解法

### 建置階段

| 問題 | 原因 | 解法 |
|---|---|---|
| CMake 報 `libsecret-1` not found | 缺 `libsecret-1-dev` | `apt-get install libsecret-1-dev` |
| 編譯成功，最後安裝步驟報 `file INSTALL cannot copy file … to /usr/local/<app>: Permission denied` | 第一次 CMake 設定中途失敗（例如缺套件）時，`CMAKE_INSTALL_PREFIX` 已被快取成預設的 `/usr/local`；專案的 `CMakeLists.txt` 只在「第一次設定」時才把它改成 App 自己的 `bundle` 目錄 | 刪掉 `aqutter/build/linux/x64/<debug\|release>/CMakeCache.txt` 再重跑（已編好的檔案保留，不必重編） |
| `pnpm install` 失敗，`node:sqlite` 找不到 | pnpm 11 需要 Node ≥ 22.13 | 改用 Node 22（見第 2 節） |

### 執行階段

| 問題 | 原因 | 解法 |
|---|---|---|
| 載入卡在約 75%，`WebProcess terminated (reason=CRASHED)` | 缺 GStreamer 外掛，網頁含 `<video>` 時 WebKit 初始化媒體失敗 | 安裝 GStreamer 外掛（第 2 節） |
| 點影片後整個頁面卡住；網頁行程 CPU 為 0%，GStreamer 的 GL、h264 解碼、佇列執行緒全部睡眠 | WebKit 的影片輸出走 DMA-BUF／GL 路徑，在軟體 GL（`llvmpipe`）環境接不起來。啟動 log 同時顯示畫面紋理零拷貝失敗、退回 `SHM mode` | 設環境變數 `WEBKIT_GST_DMABUF_SINK_DISABLED=1` 後影片正常（其他 GPU／驅動環境是否需要，**未驗證**） |
| 檔案選取失敗 | `file_picker_linux` 走 XDG Desktop Portal（D-Bus session bus），WSL 預設沒有 | 裝 D-Bus 與 portal，並用 `dbus-run-session` 執行（第 2、3 節） |
| 首次載入畫面是 `500 … null is not an object (evaluating 'currentRenderingInstance.ce')` | Vite 冷快取的已知現象：第一次在 WebKit 載入 Nuxt dev server，依賴還在預先打包 | 重啟一次即可（Chrome 不會出現） |
| `<aqutter-native>`（mirror-demo）整塊黑色、`fps: 0` | **不是鏡像本身的問題**：測試頁在建立元素**之前**先 `await` 了 battery 的呼叫，而 battery 在這個環境永遠不回應（見下一列），頁面卡在那裡，元素從未被建立。殼端的鏡像在 Linux 上正常（`native_endpoint` 回埠號、WebSocket 連線與收幀都成功） | 先建立鏡像元素，再讀電量；所有 plugin 呼叫加逾時（範本專案的 `/plugins` 頁已修正） |
| battery、connectivity 的呼叫**永遠不回應**，log 出現 `Unhandled Exception: SocketException … /var/run/dbus/system_bus_socket` | 這兩者走系統 D-Bus（UPower、NetworkManager）。WSL 沒有這些服務；例外在套件內部的非同步串流裡拋出，呼叫端的 `try/catch` 接不到，`await` 因此永遠不會結束 | 環境限制（真正的 Linux 桌面有這些服務）。網頁端對 plugin 呼叫一律加逾時，不要假設一定會回應（見 [Plugin 開發](plugins.md)） |
| 拖動或點擊鏡像時畫面突然變模糊又變清楚 | 刻意的設計：移動中降低擷取解析度（`quality` 的 `smooth`／`auto`，`minScale` 預設 0.4），動作停止後補一張完整畫質的定格幀。擷取較慢的環境（例如軟體渲染）降解析度的時間更長 | 要一律清楚可把 `AqutterNative` 的 `quality` 設為 `sharp`（代價是移動中 fps 下降）；見 [Native view 鏡像](nativeview.md) |

### 可忽略的訊息

| 訊息 | 說明 |
|---|---|
| `Can't connect to a11y bus` | 無障礙服務沒開 |
| `Atk-CRITICAL … atk_socket_embed` | 同上，無害 |
| `The GStreamer FDK AAC plugin is missing` | Debian 沒有收 FDK AAC；實測 `flower.mp4`（H.264）可播放 |
| `Gtk-WARNING … Locale not supported by C library` | 系統沒產生對應 locale |
| `host 未提供以下 handler（orientation_lock…）` | 桌面平台不支援的 handler，是預期的 |

## 5. Ubuntu

**目前不能直接在 Ubuntu 上建置與執行**，因為 Ubuntu 的套件庫沒有 WPE WebKit（見第 1 節）。可行的做法（**都未實作、未驗證**）：

| 做法 | 說明 |
|---|---|
| 自己編譯 WPE 並隨 App 打包 | 在要支持的最舊 Ubuntu（例如 24.04）的容器裡編譯 WPE，把 `.so` 放進 App 的 `lib/` 並用 RPATH 載入。Debian 13 套件裡的 `libWPEWebKit-2.0.so` 約 118 MB（未壓縮）；編譯一次後可當成檔案快取，不必每次建置重編，但每個 CPU 架構與 glibc 底線各要一份。授權為 LGPL／BSD，動態連結出貨可行，需附授權文字 |
| 改用 WebKitGTK（`libwebkit2gtk-4.1`） | Ubuntu 22.04／24.04 套件庫有，發佈只需宣告 apt 相依。但它是 GTK widget，和 Flutter 的合成方式不同：Flutter 內容疊在網頁之上、鏡像等「兩者同時出現」的功能很可能做不到；只做「Flutter 載入畫面 → 切換成全螢幕網頁」的模式則較可行。需要先用原型驗證 |
| Flatpak／Snap | 標準 runtime 提供的是 WebKitGTK 而非 WPE，能否放 WPE 未驗證 |

## 6. 已知限制

- WSL2 沒有 UPower、NetworkManager：battery、網路狀態類功能在 WSL 不能用（真正的 Linux 桌面不受影響）。
- WSL 這次是軟體 GL（`llvmpipe`），效能數字不代表有 GPU 的 Linux 機器。
- release 版、實體 Linux 機器、Wayland／X11 原生環境都還沒驗證。

## 7. 在 WSL 準備環境的小提醒

- 在 Windows 的 Git Bash 呼叫 `wsl` 時，`/mnt/c/...` 這類路徑會被轉成 `C:/Program Files/Git/mnt/c/...`；加上 `MSYS_NO_PATHCONV=1`，或把指令寫成腳本檔再執行。
- WSL 預設會把 Windows 的 `PATH` 附加進來（路徑含括號）：`export PATH="...:$PATH"` 會因此語法錯誤，也可能抓到 Windows 的 Flutter 或 pnpm。在 `/etc/wsl.conf` 設 `[interop]` 的 `appendWindowsPath=false`。
- 官方的 WSL 發行版下載若被網路（例如 VPN）重置，可用 Podman 拉 `debian:trixie`，`podman export` 後用 `wsl --import` 匯入。
