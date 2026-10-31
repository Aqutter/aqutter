// 殼套件自己的本機通知（iOS、macOS）。
// Dart 端的約定見 shell/lib/src/plugins/notification/notification_service.dart 的 PlatformLocalNotifier：
//   initialize / show / schedule / cancel / cancelAll / launchedBy（Dart -> 原生）
//   tapped（原生 -> Dart，App 執行中使用者點了通知）
//
// 殼在註冊時就把自己設為通知中心的代理：前景也顯示通知、點擊轉給 Dart、冷啟的點擊先記下。
// 所以 App 的 AppDelegate 不需要再設通知代理。
#if os(iOS)
import Flutter
import UIKit
#elseif os(macOS)
import FlutterMacOS
import Cocoa
#endif
import UserNotifications

final class AqutterNotifications: NSObject, UNUserNotificationCenterDelegate {
    static let channelName = "com.github.aqutter/notifications"

    private let channel: FlutterMethodChannel
    private var dartReady = false
    private var launchTap: [String: Any]?

    init(channel: FlutterMethodChannel) {
        self.channel = channel
        super.init()
        channel.setMethodCallHandler { [weak self] call, result in
            self?.handle(call, result: result)
        }
        // 冷啟時點通知的回呼在 App 啟動完成之前就會來，代理要及早設好
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Dart 端的呼叫

    private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let center = UNUserNotificationCenter.current()
        let arguments = call.arguments as? [String: Any]
        switch call.method {
        case "initialize":
            // 權限一律由網頁經殼的權限 handler 處理，這裡不跳授權視窗
            dartReady = true
            result(nil)
        case "show":
            guard let request = makeRequest(arguments, trigger: nil) else {
                result(FlutterError(code: "invalid_argument", message: "id and title are required", details: nil))
                return
            }
            center.add(request) { error in
                result(error.map { FlutterError(code: "notification_failed", message: $0.localizedDescription, details: nil) })
            }
        case "schedule":
            guard let atMs = (arguments?["atMs"] as? NSNumber)?.doubleValue else {
                result(FlutterError(code: "invalid_argument", message: "atMs is required", details: nil))
                return
            }
            // 以目標時間與現在的差計算，不依賴時區；觸發條件的間隔必須大於 0
            let interval = max(1, atMs / 1000 - Date().timeIntervalSince1970)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            guard let request = makeRequest(arguments, trigger: trigger) else {
                result(FlutterError(code: "invalid_argument", message: "id and title are required", details: nil))
                return
            }
            center.add(request) { error in
                result(error.map { FlutterError(code: "notification_failed", message: $0.localizedDescription, details: nil) })
            }
        case "cancel":
            guard let id = (arguments?["id"] as? NSNumber)?.intValue else {
                result(FlutterError(code: "invalid_argument", message: "id is required", details: nil))
                return
            }
            center.removePendingNotificationRequests(withIdentifiers: [String(id)])
            center.removeDeliveredNotifications(withIdentifiers: [String(id)])
            result(nil)
        case "cancelAll":
            center.removeAllPendingNotificationRequests()
            center.removeAllDeliveredNotifications()
            result(nil)
        case "launchedBy":
            result(launchTap)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private func makeRequest(_ arguments: [String: Any]?, trigger: UNNotificationTrigger?) -> UNNotificationRequest? {
        guard
            let id = (arguments?["id"] as? NSNumber)?.intValue,
            let title = arguments?["title"] as? String
        else {
            return nil
        }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = (arguments?["body"] as? String) ?? ""
        content.sound = .default
        if let payload = arguments?["payload"] as? String {
            content.userInfo = ["payload": payload]
        }
        // 識別字串就是通知 id：同一個 id 再次顯示或排程會取代原通知
        return UNNotificationRequest(identifier: String(id), content: content, trigger: trigger)
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // App 在前景時也要顯示
        if #available(iOS 14.0, macOS 11.0, *) {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([.alert, .sound])
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        defer { completionHandler() }
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else {
            return
        }
        let request = response.notification.request
        guard let id = Int(request.identifier) else {
            return
        }
        var info: [String: Any] = ["id": id]
        info["payload"] = request.content.userInfo["payload"] as? String ?? NSNull()

        if dartReady {
            channel.invokeMethod("tapped", arguments: info)
        } else if launchTap == nil {
            // Dart 還沒就緒：這是點通知而冷啟 App，記下來等 launchedBy 取走
            launchTap = info
        }
    }
}
