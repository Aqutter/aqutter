// 殼套件自己的 iOS 與 macOS 原生部分的入口：把註冊分給各功能。
//   Clipboard/AqutterClipboard.swift         圖片剪貼簿
//   Notifications/AqutterNotifications.swift 本機通知
#if os(iOS)
import Flutter
#elseif os(macOS)
import FlutterMacOS
#endif

public class AqutterShellPlugin: NSObject, FlutterPlugin {
    /// 各功能要活到引擎結束，所以由這裡持有。
    private static var clipboard: AqutterClipboard?
    private static var notifications: AqutterNotifications?

    public static func register(with registrar: FlutterPluginRegistrar) {
        #if os(iOS)
        let messenger = registrar.messenger()
        #else
        let messenger = registrar.messenger
        #endif
        clipboard = AqutterClipboard(
            channel: FlutterMethodChannel(name: AqutterClipboard.channelName, binaryMessenger: messenger)
        )
        notifications = AqutterNotifications(
            channel: FlutterMethodChannel(name: AqutterNotifications.channelName, binaryMessenger: messenger)
        )
    }
}
