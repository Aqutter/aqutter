#ifndef AQUTTER_SHELL_PLUGIN_H_
#define AQUTTER_SHELL_PLUGIN_H_

#include <flutter/method_channel.h>
#include <flutter/plugin_registrar_windows.h>

#include <memory>

namespace aqutter_shell {

// 殼套件自己的 Windows 原生部分：圖片剪貼簿。
// Dart 端的約定見 shell/lib/src/plugins/clipboard/clipboard_image_service.dart：
//   readImage  -> 剪貼簿裡的圖片（PNG 位元組），沒有圖片回 null
//   writeImage -> { data: bytes, format: "png" | "jpeg" }
class AqutterShellPlugin : public flutter::Plugin {
 public:
  static void RegisterWithRegistrar(flutter::PluginRegistrarWindows* registrar);

  explicit AqutterShellPlugin(
      std::unique_ptr<flutter::MethodChannel<flutter::EncodableValue>> channel)
      : channel_(std::move(channel)) {}
  ~AqutterShellPlugin() override = default;

  AqutterShellPlugin(const AqutterShellPlugin&) = delete;
  AqutterShellPlugin& operator=(const AqutterShellPlugin&) = delete;

 private:
  // 通道由 plugin 持有，隨引擎一起結束
  std::unique_ptr<flutter::MethodChannel<flutter::EncodableValue>> channel_;
};

}  // namespace aqutter_shell

#endif  // AQUTTER_SHELL_PLUGIN_H_
