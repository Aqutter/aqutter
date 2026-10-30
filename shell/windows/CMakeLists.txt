cmake_minimum_required(VERSION 3.14)
set(PROJECT_NAME "aqutter")
project(${PROJECT_NAME} LANGUAGES CXX)

# 殼套件本身的 Windows 原生部分（目前只有圖片剪貼簿）。

set(PLUGIN_NAME "aqutter_plugin")

add_library(${PLUGIN_NAME} SHARED
  "aqutter_shell_plugin_c_api.cpp"
  "aqutter_shell_plugin.cpp"
  "aqutter_shell_plugin.h"
  "clipboard_image.cpp"
  "clipboard_image.h"
)

apply_standard_settings(${PLUGIN_NAME})
set_target_properties(${PLUGIN_NAME} PROPERTIES CXX_VISIBILITY_PRESET hidden)
target_compile_definitions(${PLUGIN_NAME} PRIVATE FLUTTER_PLUGIN_IMPL)
# 原始碼是 UTF-8 且註解有中文；沒有這個旗標時 MSVC 依系統碼頁讀檔，中文註解可能吃掉換行而讓程式壞掉
target_compile_options(${PLUGIN_NAME} PRIVATE /utf-8)
target_include_directories(${PLUGIN_NAME} INTERFACE
  "${CMAKE_CURRENT_SOURCE_DIR}/include")
# windowscodecs：解碼與編碼 PNG／JPEG／BMP（Windows 內建的 WIC）
target_link_libraries(${PLUGIN_NAME} PRIVATE flutter flutter_wrapper_plugin windowscodecs ole32)

# 要隨 App 一起打包的函式庫（沒有）
set(aqutter_bundled_libraries
  ""
  PARENT_SCOPE
)
