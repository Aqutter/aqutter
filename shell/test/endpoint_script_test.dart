import 'package:aqutter/src/bridge/endpoint_script.dart';
import 'package:aqutter_core/aqutter_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('endpoint script', () {
    test('defines a frozen window.aqutterEndpoint with the port and the token', () {
      const endpoint = AqutterNativeEndpoint(port: 51234, token: 'abc-DEF_123');
      expect(
        buildEndpointScript(endpoint),
        'Object.defineProperty(window,"aqutterEndpoint",{value:Object.freeze({port:51234,token:"abc-DEF_123"}),configurable:true,enumerable:false,writable:false});',
      );
    });

    test('writes the token as a JSON string, so any content stays a valid string literal', () {
      const endpoint = AqutterNativeEndpoint(port: 1, token: 'a"b\\c\nd</script>');
      final script = buildEndpointScript(endpoint);
      expect(script, contains(r'token:"a\"b\\c\nd</script>"'));
      expect(script, isNot(contains('\n')));
    });

    test('is injected at document start, for the main frame only, in a group the shell can replace', () {
      const endpoint = AqutterNativeEndpoint(port: 7, token: 't');
      final userScript = buildEndpointUserScript(endpoint);
      expect(userScript.injectionTime, AqutterUserScriptInjectionTime.AT_DOCUMENT_START);
      expect(userScript.forMainFrameOnly, isTrue);
      expect(userScript.groupName, aqutterEndpointScriptGroup);
      expect(userScript.source, buildEndpointScript(endpoint));
    });

    test('a new endpoint produces a different script (so an update really changes what the page reads)', () {
      expect(
        buildEndpointScript(const AqutterNativeEndpoint(port: 1, token: 'a')),
        isNot(buildEndpointScript(const AqutterNativeEndpoint(port: 2, token: 'b'))),
      );
    });
  });
}
