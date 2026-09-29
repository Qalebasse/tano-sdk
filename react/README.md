# @tano-africa/react

[![npm](https://img.shields.io/npm/v/@tano-africa/react.svg)](https://www.npmjs.com/package/@tano-africa/react)
[![license](https://img.shields.io/npm/l/@tano-africa/react.svg)](LICENSE)

The [Tano](https://docs.tano.africa) identity verification journey as a React component, built on
[`@tano-africa/web`](https://www.npmjs.com/package/@tano-africa/web).

## Installation

```bash
npm install @tano-africa/react
```

React 18 or later.

## Usage

Allow your origin in the Tano console (*Developers* → *Journey in your pages*), create the session
on your server, then:

```tsx
import { TanoVerification } from "@tano-africa/react";

export function Verification({ url }: { url: string }) {
  return (
    <TanoVerification
      url={url}
      onCompleted={() => router.push("/verification/thanks")}
      onEnded={(reason) => setEnded(reason)}
      onExpired={() => fetch("/api/verification/link").then((r) => r.json()).then((j) => j.url)}
    />
  );
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `url` | `string` | Session URL. Changing it remounts the journey |
| `onReady` | `() => void` | The journey is displayed |
| `onStep` | `(step) => void` | A step starts |
| `onCompleted` | `() => void` | Everything was sent — read the case on your server |
| `onEnded` | `(reason) => void` | `declined`, `expired`, `invalid_link`, `later` |
| `onEvent` | `(event) => void` | Every event, raw |
| `onExpired` | `() => Promise<string>` | Return a new session URL to resume in place |
| `minHeight` | `number` | Minimum frame height in pixels |
| `title` | `string` | Accessible title of the frame |
| `className`, `style` | | Applied to the container |

Callbacks are always read fresh: changing them does not reload the journey.

## License

[MIT](LICENSE) © Qalebasse
