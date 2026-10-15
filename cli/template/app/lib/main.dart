import 'package:aqutter/aqutter.dart';

import 'aqutter_plugins.dart';

Future<void> main() => runAqutter(
      config: const AqutterConfig(title: '{{displayName}}'),
      plugins: aqutterPlugins,
    );
