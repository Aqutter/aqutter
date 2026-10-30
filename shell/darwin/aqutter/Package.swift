// swift-tools-version: 5.9
// 殼套件本身的 iOS 與 macOS 原生部分（目前只有圖片剪貼簿）。結構對照 permission_plus_apple。

import PackageDescription

let package = Package(
    name: "aqutter",
    platforms: [
        .iOS("13.0"),
        .macOS("10.15")
    ],
    products: [
        .library(name: "aqutter", targets: ["aqutter"])
    ],
    dependencies: [
        .package(name: "FlutterFramework", path: "../FlutterFramework")
    ],
    targets: [
        .target(
            name: "aqutter",
            dependencies: [
                .product(name: "FlutterFramework", package: "FlutterFramework")
            ]
        )
    ]
)
