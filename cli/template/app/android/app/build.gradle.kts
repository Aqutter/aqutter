plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "{{orgId}}.{{appName}}"
    // 刻意脫離 Flutter 預設（3.47 的 flutter.compileSdkVersion 為 36）。
    // 原因是先前的 permission_handler_android 14 自身寫死 compileSdk = 37，app 模組不得低於任何相依模組；
    // 已改用 permission_plus（其 Android 實作為 36），此釘選不再被它強制，但未在 Android 上驗證還原，故維持 37。
    // 代價是建置機需安裝 SDK Platform 37（platforms/android-37.0）。
    // 確認其餘相依皆不需要 37 後，這行可改回 flutter.compileSdkVersion。
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "{{orgId}}.{{appName}}"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
