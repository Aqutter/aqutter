import 'package:aqutter/aqutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('handler and event names are namespaced by plugin id', () {
    expect(aqutterPluginHandlerName('haptics', 'impact'), 'haptics.impact');
    expect(aqutterPluginEventChannel('battery', 'changed'), 'battery.changed');
  });

  test('plugin id pattern rejects dots, uppercase and leading digits', () {
    for (final ok in ['haptics', 'native-view', 'a1']) {
      expect(aqutterPluginIdPattern.hasMatch(ok), isTrue, reason: ok);
    }
    for (final bad in ['Haptics', 'a.b', '1a', '', 'a_b']) {
      expect(aqutterPluginIdPattern.hasMatch(bad), isFalse, reason: bad);
    }
  });
}
