pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    // 版本需 >= 各 plugin 自行宣告的 AGP（plus 系列 8.12.1、file_picker 8.5.2），
    // 否則其 Android 模組不會被納入編譯（症狀：GeneratedPluginRegistrant 找不到 plugin class）。
    //
    // AGP 9 的前提：WebView 套件（pub 上的 flutter_inappwebview_android）使用 AGP 9 已移除的 lintOptions {}，
    // 故改用自有套件 aqutter_core，其 Android 端已支援 AGP 9（見 ../pubspec.yaml）。
    // 改回 pub 上的套件就必須把 AGP 降回 8.x。
    id("com.android.application") version "9.3.1" apply false
    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
}

include(":app")
