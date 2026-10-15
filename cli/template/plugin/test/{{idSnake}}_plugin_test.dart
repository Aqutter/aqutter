import 'package:{{dartPackage}}/{{dartPackage}}.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ping echoes the message', () async {
    final plugin = {{className}}Plugin();
    final result = await plugin.handlers['ping']!({'message': 'hi'});
    expect(result, {'echo': 'hi'});
  });

  test('id follows the naming rule', () {
    expect({{className}}Plugin().id, '{{id}}');
  });
}
