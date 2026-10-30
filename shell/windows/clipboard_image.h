#ifndef AQUTTER_SHELL_CLIPBOARD_IMAGE_H_
#define AQUTTER_SHELL_CLIPBOARD_IMAGE_H_

#include <cstdint>
#include <string>
#include <vector>

namespace aqutter_shell {

// 讀剪貼簿裡的圖片，一律轉成 PNG 位元組放進 [png]。
// 剪貼簿沒有圖片時回 true 且 [png] 為空；失敗回 false 並在 [error] 寫原因。
bool ReadClipboardPng(std::vector<uint8_t>* png, std::string* error);

// 把 PNG 或 JPEG 放進剪貼簿：PNG 另外放一份 "PNG" 格式（多數 App 讀這個，保留透明度），
// 並一律放一份 CF_DIB 給只認傳統格式的 App。
bool WriteClipboardImage(const std::vector<uint8_t>& bytes, bool is_png,
                         std::string* error);

}  // namespace aqutter_shell

#endif  // AQUTTER_SHELL_CLIPBOARD_IMAGE_H_
