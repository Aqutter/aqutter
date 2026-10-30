#include "include/aqutter/aqutter_shell_plugin_c_api.h"

#include <flutter/plugin_registrar_windows.h>

#include "aqutter_shell_plugin.h"

void AqutterShellPluginCApiRegisterWithRegistrar(
    FlutterDesktopPluginRegistrarRef registrar) {
  aqutter_shell::AqutterShellPlugin::RegisterWithRegistrar(
      flutter::PluginRegistrarManager::GetInstance()
          ->GetRegistrar<flutter::PluginRegistrarWindows>(registrar));
}
