// 殼套件自己的 iOS 與 macOS 原生部分：圖片剪貼簿（本檔）與本機通知（AqutterNotifications.swift）。
// Dart 端的約定見 shell/lib/src/bridge/clipboard_image_service.dart：
//   readImage  -> 剪貼簿裡的圖片（PNG 位元組），沒有圖片回 nil
//   writeImage -> { data: bytes, format: "png" | "jpeg" }
#if os(iOS)
import Flutter
import UIKit
#elseif os(macOS)
import FlutterMacOS
import Cocoa
#endif

public class AqutterShellPlugin: NSObject, FlutterPlugin {
    private static let channelName = "com.github.aqutter/clipboard"

    /// 本機通知（見 AqutterNotifications.swift）；要活到引擎結束，所以由這裡持有。
    private static var notifications: AqutterNotifications?

    public static func register(with registrar: FlutterPluginRegistrar) {
        #if os(iOS)
        let messenger = registrar.messenger()
        #else
        let messenger = registrar.messenger
        #endif
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
        registrar.addMethodCallDelegate(AqutterShellPlugin(), channel: channel)
        notifications = AqutterNotifications(
            channel: FlutterMethodChannel(name: AqutterNotifications.channelName, binaryMessenger: messenger)
        )
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "readImage":
            if let png = readPng() {
                result(FlutterStandardTypedData(bytes: png))
            } else {
                result(nil)
            }
        case "writeImage":
            guard
                let arguments = call.arguments as? [String: Any],
                let data = arguments["data"] as? FlutterStandardTypedData
            else {
                result(FlutterError(code: "invalid_argument", message: "data is required", details: nil))
                return
            }
            let isJpeg = (arguments["format"] as? String) == "jpeg"
            if writeImage(data.data, isJpeg: isJpeg) {
                result(nil)
            } else {
                result(FlutterError(code: "clipboard_write_failed", message: "cannot write the clipboard", details: nil))
            }
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    #if os(iOS)
    private func readPng() -> Data? {
        // hasImages 不會觸發 iOS 16 之後的「貼上」確認；沒有圖片時直接回 nil，不去讀內容
        guard UIPasteboard.general.hasImages, let image = UIPasteboard.general.image else {
            return nil
        }
        return image.pngData()
    }

    private func writeImage(_ data: Data, isJpeg: Bool) -> Bool {
        // 以原始位元組放進剪貼簿，不重新編碼
        let type = isJpeg ? "public.jpeg" : "public.png"
        UIPasteboard.general.setItems([[type: data]])
        return true
    }
    #else
    private func readPng() -> Data? {
        let pasteboard = NSPasteboard.general
        if let png = pasteboard.data(forType: .png) {
            return png
        }
        guard
            let tiff = pasteboard.data(forType: .tiff),
            let bitmap = NSBitmapImageRep(data: tiff)
        else {
            return nil
        }
        return bitmap.representation(using: .png, properties: [:])
    }

    private func writeImage(_ data: Data, isJpeg: Bool) -> Bool {
        let pasteboard = NSPasteboard.general
        let primary: NSPasteboard.PasteboardType = isJpeg ? NSPasteboard.PasteboardType("public.jpeg") : .png
        pasteboard.clearContents()
        var ok = pasteboard.setData(data, forType: primary)
        // 另放一份 TIFF，只認傳統格式的 App 也貼得到
        if let image = NSImage(data: data), let tiff = image.tiffRepresentation {
            ok = pasteboard.setData(tiff, forType: .tiff) || ok
        }
        return ok
    }
    #endif
}
