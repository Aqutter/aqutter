// 殼套件本身的 Android 原生部分（圖片剪貼簿、本機通知）。一律 Kotlin：用 AGP 9 內建的 Kotlin 支援，
// 不另套 Kotlin 外掛；寫法對照 aqutter_core（android/build.gradle）。
group = "com.github.aqutter.shell"
version = "1.0-SNAPSHOT"

buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath("com.android.tools.build:gradle:9.3.0")
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

// Kotlin 與 Java 的 JVM target 必須一致，否則 Gradle 會拒絕編譯
kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
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
