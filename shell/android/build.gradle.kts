// 殼套件本身的 Android 原生部分（目前只有圖片剪貼簿）。純 Java，不依賴 Kotlin 外掛，
// 避免與 App 端 AGP 9 的內建 Kotlin 設定互相牽制；寫法對照 battery_plus。
group = "com.github.aqutter.shell"
version = "1.0-SNAPSHOT"

buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath("com.android.tools.build:gradle:8.12.1")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

plugins {
    id("com.android.library")
}

android {
    namespace = "com.github.aqutter.shell"
    compileSdk = flutter.compileSdkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        minSdk = 21
    }
}

dependencies {
    // FileProvider：圖片剪貼簿以 content:// 交給其他 App 貼上
    implementation("androidx.core:core:1.16.0")
}
