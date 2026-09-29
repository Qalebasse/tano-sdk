import 'package:flutter_test/flutter_test.dart';
import 'package:tano_flutter/tano_flutter.dart';

void main() {
  test('lit les événements du parcours', () {
    expect(TanoEvent.parse('{"type":"tano:ready","version":1}'), const TanoReady());
    expect(TanoEvent.parse('{"type":"tano:step","step":"face"}'), const TanoStep('face'));
    expect(TanoEvent.parse('{"type":"tano:completed"}'), const TanoCompleted());
    expect(TanoEvent.parse('{"type":"tano:ended","reason":"expired"}'), const TanoEnded('expired'));
  });

  test("ignore ce qui n'est pas un événement", () {
    expect(TanoEvent.parse('pas du json'), isNull);
    expect(TanoEvent.parse('{"type":"tano:resize","height":800}'), isNull);
    expect(TanoEvent.parse('{"type":"tano:step"}'), isNull);
  });

  test("n'admet que HTTPS ou localhost, et compare les origines", () {
    expect(journeyUrlAllowed(Uri.parse('https://verify.tano.africa/#t')), isTrue);
    expect(journeyUrlAllowed(Uri.parse('http://localhost:5188/#t')), isTrue);
    expect(journeyUrlAllowed(Uri.parse('http://verify.tano.africa/#t')), isFalse);
    expect(sameOrigin(Uri.parse('https://verify.tano.africa/#t'), Uri.parse('https://verify.tano.africa/v1/x')), isTrue);
    expect(sameOrigin(Uri.parse('https://verify.tano.africa/'), Uri.parse('https://evil.example/')), isFalse);
  });
}
