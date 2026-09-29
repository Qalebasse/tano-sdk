# Tano SDKs

Official client libraries for [Tano](https://docs.tano.africa) — identity verification (KYC) built
for Africa.

| Package | Platform | Install |
| --- | --- | --- |
| [`@tano-africa/node`](node) | Node.js server | `npm install @tano-africa/node` |
| [`tano-sdk`](python) | Python server | `pip install tano-sdk` |
| [`@tano-africa/web`](web) | Browser | `npm install @tano-africa/web` |
| [`@tano-africa/react`](react) | React | `npm install @tano-africa/react` |
| [`@tano-africa/react-native`](react-native) | React Native | `npm install @tano-africa/react-native react-native-webview` |
| [`TanoSDK`](ios) | iOS (Swift) | Swift Package Manager |
| [`tano-android`](android) | Android (Kotlin) | Gradle module |
| [`tano_flutter`](flutter) | Flutter | pub package |

## How an integration fits together

```
 Your server ──(API key, signed)──▶ Tano API ──(webhooks, signed)──▶ Your server
      │  POST /v1/cases                                case.decided
      │  POST /v1/sessions → url
      ▼
 Your web page / mobile app ──(url)──▶ Tano verification journey (hosted, embedded or in-app)
```

1. **Server** — create a case and a session with a server SDK. Keep your API key on the server.
2. **Client** — open the journey with the session `url`: in your page (`@tano-africa/web`,
   `@tano-africa/react`), in a popup, or in your mobile app (iOS, Android, Flutter, React Native).
3. **Decision** — read it on your server: webhook `case.decided`, or `cases.results(id)`.

Client SDKs only report the journey's progress (`ready`, `step`, `completed`, `ended`). They never
carry a result or personal data: anything in a browser or an app can be forged, a server-side
signature cannot.

## Security

- Requests to the API are signed with HMAC-SHA256 (v2) and protected against replay; webhooks are
  signed and timestamped. The server SDKs handle both.
- Reading personal data, downloading images and deciding on cases require explicit API key
  permissions (`personal_data`, `decisions`), granted in the console. Every read is logged.
- The embedded journey only renders inside pages whose origin you allowed, verified by the browser.

Report a vulnerability to **security@tano.africa**. Please do not open a public issue.

## Development

```bash
pnpm install && pnpm lint && pnpm types && pnpm test && pnpm build      # JavaScript packages
cd python && uv sync && uv run ruff check . && uv run mypy && uv run pytest
cd ios && swift test
cd android && ./gradlew :tano:testDebugUnitTest :demo:assembleDebug
cd flutter && flutter analyze && flutter test
```

Signatures are tested against vectors computed by the Tano API itself.

## License

[MIT](LICENSE) © Qalebasse
