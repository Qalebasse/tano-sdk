# @tano-africa/react-native

[![npm](https://img.shields.io/npm/v/@tano-africa/react-native.svg)](https://www.npmjs.com/package/@tano-africa/react-native)
[![license](https://img.shields.io/npm/l/@tano-africa/react-native.svg)](LICENSE)

The [Tano](https://docs.tano.africa) identity verification journey in a React Native app, built on
`react-native-webview`.

## Installation

```bash
npm install @tano-africa/react-native react-native-webview
```

Then:

- **iOS** — add `NSCameraUsageDescription` to `Info.plist`, then `pod install`.
- **Android** — declare `android.permission.CAMERA` and request it before opening the journey
  (for example with `react-native-permissions`).

React Native 0.73 or later, `react-native-webview` 13 or later.

## Usage

```tsx
import { TanoVerification } from "@tano-africa/react-native";

<TanoVerification
  url={session.url} // created by your server (POST /v1/sessions)
  onEvent={(event) => {
    if (event.type === "completed") navigation.replace("Thanks"); // then read the case server-side
    if (event.type === "ended") showRetry(event.reason);          // declined, expired, cancelled…
  }}
/>
```

## Events

| `type` | Payload |
| --- | --- |
| `ready` | — |
| `step` | `step`: `consent`, `applicant`, `questionnaire`, `document`, `face`, `check`, `uploading`, `help` |
| `completed` | — |
| `ended` | `reason`: `declined`, `expired`, `invalid_link`, `later`, or `cancelled` when the screen closes first |

## Security

- The camera is granted to the journey's origin only; navigation stays on that origin and external
  links open in the system browser.
- The web view runs incognito: nothing from the journey is kept on the device.
- Events never carry a result or personal data — read the decision on your server.

## License

[MIT](LICENSE) © Qalebasse
