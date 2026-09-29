# @tano-africa/react-native

Le parcours de vérification Tano dans une application React Native, avec
`react-native-webview`.

```tsx
import { TanoVerification } from "@tano-africa/react-native";

<TanoVerification
  url={session.url} // créée par votre serveur (POST /v1/sessions)
  onEvent={(e) => {
    if (e.type === "completed") afficherMerci(); // puis lisez le dossier côté serveur
    if (e.type === "ended") reprendre(e.reason);  // declined, expired, cancelled…
  }}
/>
```

iOS : `NSCameraUsageDescription`. Android : permission `CAMERA`, demandée avant d'ouvrir le
parcours. Aucun événement ne porte de résultat : la décision se lit côté serveur.
