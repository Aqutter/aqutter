import 'dart:async';

import 'package:aqutter/src/webview_transparency.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late ValueNotifier<int> sessions;
  late List<bool> applied;
  late List<Object> errors;

  setUp(() {
    sessions = ValueNotifier<int>(0);
    applied = [];
    errors = [];
  });

  WebViewTransparency make({Future<void> Function(bool)? apply}) => WebViewTransparency(
        sessions: sessions,
        apply: apply ?? (value) async => applied.add(value),
        onError: errors.add,
      );

  Future<void> settle() => Future<void>.delayed(Duration.zero);

  test('wanted follows whether any session is passthrough', () {
    final transparency = make();
    expect(transparency.wanted, isFalse);
    sessions.value = 2;
    expect(transparency.wanted, isTrue);
    sessions.value = 0;
    expect(transparency.wanted, isFalse);
    transparency.dispose();
  });

  test('does nothing before a WebView is attached, then applies the difference on attach', () async {
    final transparency = make();
    sessions.value = 1;
    await settle();
    expect(applied, isEmpty, reason: 'no WebView yet');

    transparency.attach(transparent: false);
    await settle();
    expect(applied, [true], reason: 'the WebView was created opaque but a session is passthrough');
    transparency.dispose();
  });

  test('no call when the WebView was created with the wanted state', () async {
    sessions.value = 1;
    final transparency = make()..attach(transparent: true);
    await settle();
    expect(applied, isEmpty);
    transparency.dispose();
  });

  test('toggles with the session count and ignores changes that do not cross zero', () async {
    final transparency = make()..attach(transparent: false);
    sessions.value = 1;
    await settle();
    sessions.value = 3;
    sessions.value = 2;
    await settle();
    sessions.value = 0;
    await settle();
    expect(applied, [true, false]);
    transparency.dispose();
  });

  test('applies one request at a time and re-checks the latest demand afterwards', () async {
    final gate = Completer<void>();
    var concurrent = 0;
    var maxConcurrent = 0;
    final transparency = make(apply: (value) async {
      concurrent += 1;
      maxConcurrent = concurrent > maxConcurrent ? concurrent : maxConcurrent;
      applied.add(value);
      await gate.future;
      concurrent -= 1;
    })
      ..attach(transparent: false);

    sessions.value = 1; // starts applying true and waits on the gate
    await settle();
    sessions.value = 0; // demand flips back while the first call is still running
    sessions.value = 1;
    sessions.value = 0;
    await settle();
    expect(applied, [true], reason: 'still waiting for the first call');

    gate.complete();
    await settle();
    await settle();
    expect(applied, [true, false], reason: 'the latest demand (opaque) is applied afterwards, once');
    expect(maxConcurrent, 1);
    transparency.dispose();
  });

  test('a failure is reported once and stops retrying until the next WebView', () async {
    var shouldFail = true;
    final transparency = make(apply: (value) async {
      applied.add(value);
      if (shouldFail) {
        throw StateError('no transparency');
      }
    })
      ..attach(transparent: false);

    sessions.value = 1;
    await settle();
    expect(errors, hasLength(1));
    sessions.value = 0;
    sessions.value = 1;
    await settle();
    expect(applied, [true], reason: 'no retry loop after a failure');

    shouldFail = false;
    transparency.attach(transparent: false); // a new WebView
    await settle();
    expect(applied, [true, true]);
    expect(errors, hasLength(1));
    transparency.dispose();
  });

  test('does not touch a detached WebView and stops listening after dispose', () async {
    final transparency = make()..attach(transparent: false);
    transparency.detach();
    sessions.value = 1;
    await settle();
    expect(applied, isEmpty);

    transparency.attach(transparent: false);
    await settle();
    expect(applied, [true]);

    transparency.dispose();
    sessions.value = 0;
    await settle();
    expect(applied, [true]);
  });
}
