#
# 殼套件本身的 iOS 與 macOS 原生部分（CocoaPods 版）。專案以 Swift Package 為主，這份只為了還在用 CocoaPods 的 App。
#
Pod::Spec.new do |s|
  s.name             = 'aqutter'
  s.version          = '0.0.1'
  s.summary          = 'Aqutter shell native code (clipboard images).'
  s.description      = <<-DESC
Native code of the Aqutter shell package: the image clipboard.
                       DESC
  s.homepage         = 'https://github.com/Aqutter/aqutter'
  s.license          = { :type => 'Apache-2.0' }
  s.author           = { 'Aqutter' => 'noreply@example.com' }
  s.source           = { :path => '.' }
  s.source_files = 'aqutter/Sources/aqutter/**/*'

  s.ios.deployment_target = '13.0'
  s.osx.deployment_target = '10.15'

  s.ios.dependency 'Flutter'
  s.osx.dependency 'FlutterMacOS'

  # Flutter.framework does not contain a i386 slice, which is specific to iOS.
  s.ios.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.osx.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  s.swift_version = '5.0'
end
