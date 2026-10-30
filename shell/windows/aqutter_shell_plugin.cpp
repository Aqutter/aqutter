#include "aqutter_shell_plugin.h"

#include <flutter/standard_method_codec.h>

#include <string>
#include <vector>

#include "clipboard_image.h"

namespace aqutter_shell {

namespace {

constexpr char kChannel[] = "com.github.aqutter/clipboard";

using flutter::EncodableMap;
using flutter::EncodableValue;

void HandleMethodCall(
    const flutter::MethodCall<EncodableValue>& call,
    std::unique_ptr<flutter::MethodResult<EncodableValue>> result) {
  if (call.method_name() == "readImage") {
    std::vector<uint8_t> png;
    std::string error;
    if (!ReadClipboardPng(&png, &error)) {
      result->Error("clipboard_read_failed", error);
      return;
    }
    if (png.empty()) {
      result->Success();  // 剪貼簿沒有圖片 -> null
      return;
    }
    result->Success(EncodableValue(std::move(png)));
    return;
  }

  if (call.method_name() == "writeImage") {
    const auto* arguments = std::get_if<EncodableMap>(call.arguments());
    if (arguments == nullptr) {
      result->Error("invalid_argument", "arguments must be a map");
      return;
    }
    auto data = arguments->find(EncodableValue("data"));
    auto format = arguments->find(EncodableValue("format"));
    const auto* bytes = data == arguments->end()
                            ? nullptr
                            : std::get_if<std::vector<uint8_t>>(&data->second);
    if (bytes == nullptr) {
      result->Error("invalid_argument", "data is required");
      return;
    }
    const auto* format_name =
        format == arguments->end() ? nullptr
                                   : std::get_if<std::string>(&format->second);
    const bool is_png = format_name == nullptr || *format_name != "jpeg";
    std::string error;
    if (!WriteClipboardImage(*bytes, is_png, &error)) {
      result->Error("clipboard_write_failed", error);
      return;
    }
    result->Success();
    return;
  }

  result->NotImplemented();
}

}  // namespace

// static
void AqutterShellPlugin::RegisterWithRegistrar(
    flutter::PluginRegistrarWindows* registrar) {
  auto channel = std::make_unique<flutter::MethodChannel<EncodableValue>>(
      registrar->messenger(), kChannel,
      &flutter::StandardMethodCodec::GetInstance());
  channel->SetMethodCallHandler(
      [](const auto& call, auto result) { HandleMethodCall(call, std::move(result)); });
  registrar->AddPlugin(std::make_unique<AqutterShellPlugin>(std::move(channel)));
}

}  // namespace aqutter_shell
