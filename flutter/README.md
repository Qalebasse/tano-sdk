# tano_flutter

The [Tano](https://docs.tano.africa) identity verification journey in your Flutter app (Android and
iOS), with its progress events.

## Requirements

Flutter 3.24 or later · Dart 3.5 or later · Android API 24+ · iOS 15+.

## Installation

Until the package is published on pub.dev, depend on it by path or git:

```yaml
dependencies:
  tano_flutter:
    path: path/to/tano-sdk/flutter
```

- **iOS** — add `NSCameraUsageDescription` to `Info.plist`.
- **Android** — declare `android.permission.CAMERA` and request it before opening the journey
  (for example with `permission_handler`).

## Usage

```dart
import 'package:tano_flutter/tano_flutter.dart';

TanoVerification(
  url: Uri.parse(session.url), // created by your server (POST /v1/sessions)
  onEvent: (event) => switch (event) {
    TanoReady() => null,
    TanoStep(:final step) => analytics.track(step),
    TanoCompleted() => showThankYou(),            // then read the case on your server
    TanoEnded(:final reason) => offerRetry(reason), // declined, expired, cancelled…
  },
)
```

## API

| Symbol | Description |
| --- | --- |
| `TanoVerification({required Uri url, required onEvent})` | The journey, in a `WebViewWidget` |
| `TanoEvent` | `TanoReady`, `TanoStep(step)`, `TanoCompleted`, `TanoEnded(reason)` |

`TanoEnded.reason`: `declined`, `expired`, `invalid_link`, `later`, or `cancelled` when the widget
is disposed before the end.

## Security

- The camera is granted on request; navigation stays on the journey's origin and external links
  open in the system browser.
- Cache and local storage are cleared when the widget is disposed.
- Events never carry a result or personal data — read the decision on your server.

## Example

`example/` opens the journey and logs its events.

## License

MIT © Qalebasse
