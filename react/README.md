# @tano/react

Le parcours de vérification Tano, intégré dans une page React.

```tsx
import { TanoVerification } from "@tano/react";

<TanoVerification
  url={session.url}                       // créée par votre serveur
  onCompleted={() => router.push("/verification/merci")}
  onExpired={() => fetch("/api/verification/lien").then((r) => r.json()).then((j) => j.url)}
/>
```

Votre origine doit figurer parmi les domaines autorisés (console, page Développeurs).
