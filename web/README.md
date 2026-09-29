# @tano-africa/web

[![npm](https://img.shields.io/npm/v/@tano-africa/web.svg)](https://www.npmjs.com/package/@tano-africa/web)
[![license](https://img.shields.io/npm/l/@tano-africa/web.svg)](LICENSE)

The official browser library for [Tano](https://docs.tano.africa): run the identity verification
journey **inside your page**, in a popup, or in the current tab — and follow its progress.

- Embedded journey (`mount`) with an origin-verified handshake — it never renders on a site you did not allow
- Popup or redirect (`launch`), with a return page that notifies the opening tab
- Progress events, automatic height, expired-link renewal in place
- Under 3 kB minified, zero dependencies, ESM and a `<script>` build

## Installation

```bash
npm install @tano-africa/web
```

Or without a bundler:

```html
<script src="https://cdn.jsdelivr.net/npm/@tano-africa/web/dist/tano-web.global.js"></script>
<!-- window.TanoWeb.mount(…), window.TanoWeb.launch(…), window.TanoWeb.handleReturn() -->
```

## Embed the journey in your page (recommended)

1. **Allow your origins** in the Tano console → *Developers* → *Journey in your pages*
   (`https://www.your-site.com`; add `http://localhost:5173` for development).
2. **Create a session on your server** (`POST /v1/sessions`) and return its `url` to the page.
3. **Mount the journey**:

```ts
import { mount } from "@tano-africa/web";

const journey = mount("#verification", {
  url: session.url,
  onStep: (step) => trackStep(step),        // consent, document, face, uploading…
  onCompleted: () => showThankYou(),        // then read the case on your server
  onEnded: (reason) => offerRetry(reason),  // declined, expired, invalid_link, later
  // The link expired: return a fresh one and the journey resumes in the same frame.
  onExpired: () => fetch("/api/verification/link").then((r) => r.json()).then((j) => j.url),
});

// journey.destroy() removes it.
```

The camera is delegated to the journey frame only (`allow="camera"`), with no referrer. The journey
completes a handshake with your page before rendering: the browser attests your page's origin,
which must be in your allowed list — framed anywhere else, it shows a refusal and sends nothing.

### `mount(target, options)`

| Option | Type | Description |
| --- | --- | --- |
| `url` | `string` | The session URL from `POST /v1/sessions`. Required |
| `onReady` | `() => void` | The journey is displayed |
| `onStep` | `(step: EmbedStep) => void` | A step starts |
| `onCompleted` | `() => void` | Everything was sent |
| `onEnded` | `(reason: EndReason) => void` | Stopped without sending |
| `onEvent` | `(event: JourneyEvent) => void` | Every event, raw |
| `onExpired` | `() => Promise<string>` | Return a new session URL to resume in place |
| `autoHeight` | `boolean` | Follow the journey's height (default `true`) |
| `minHeight` | `number` | Frame height in pixels (default `640`) |
| `title` | `string` | Accessible title of the frame |

Returns `{ iframe: HTMLIFrameElement, destroy(): void }`.

## Popup or redirect

```ts
import { launch } from "@tano-africa/web";

button.addEventListener("click", () => {
  launch({ url: session.url, onReturn: () => refreshStatus() });
});
```

`launch` opens a popup (from a user gesture), or the current tab if the popup is blocked
(`fallbackToRedirect: false` to forbid it; `mode: "redirect"` to always use the tab). Create the
session with a `return_url` on your site; on that page:

```ts
import { handleReturn } from "@tano-africa/web";

const context = await handleReturn(); // "popup": this window closes · "page": continue here
```

## Events

| Event | Payload |
| --- | --- |
| `tano:ready` | `version` |
| `tano:step` | `step`: `consent`, `applicant`, `questionnaire`, `document`, `face`, `check`, `uploading`, `help` |
| `tano:completed` | — |
| `tano:ended` | `reason`: `declined`, `expired`, `invalid_link`, `later` |
| `tano:resize` | `height` |

Events never carry a result or personal data. **Read the decision on your server** — webhook
`case.decided`, or `GET /v1/cases/{id}/results`.

## Errors

`TanoWebError` with `code`: `invalid_url` (not HTTPS, except `localhost`), `popup_blocked`,
`unsupported`.

## Browser support

Current Chrome, Edge, Firefox and Safari (iOS 15.4+) — `BroadcastChannel` and
`MessageEvent.origin`.

## License

[MIT](LICENSE) © Qalebasse
