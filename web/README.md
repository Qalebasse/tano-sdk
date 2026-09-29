# @tano-africa/web

Le SDK navigateur de Tano : afficher le parcours de vérification **dans votre page**, ou l'ouvrir
dans une fenêtre, et savoir où en est la personne.

## Dans votre page (recommandé)

1. Dans la console, page Développeurs, ajoutez votre origine aux **domaines autorisés**
   (`https://votre-site.example`, et `http://localhost:5173` pour développer).
2. Votre serveur crée la session et rend son `url`.
3. La page affiche le parcours :

```ts
import { mount } from "@tano-africa/web";

const parcours = mount("#verification", {
  url,
  onStep: (etape) => suivi(etape), // consent, document, face, uploading…
  onCompleted: () => afficherMerci(), // puis lisez le dossier côté serveur
  onEnded: (raison) => proposerDeRecommencer(raison), // declined, expired, invalid_link, later
  // Le lien a expiré : un nouveau, et le parcours reprend dans le même cadre.
  onExpired: () => fetch("/api/verification/lien").then((r) => r.json()).then((j) => j.url),
});
// parcours.destroy() pour le retirer.
```

Le parcours ne s'affiche qu'après une poignée de main avec votre page, dont le navigateur atteste
l'origine : encadré par une page qui n'est pas dans votre liste, il refuse de s'afficher. La
caméra lui est déléguée (`allow="camera"`), et à lui seul. En React : `@tano-africa/react`.

## Dans une fenêtre ou l'onglet

```bash
npm install @tano-africa/web
```

ou, sans outil de build :

```html
<script src="https://cdn.jsdelivr.net/npm/@tano-africa/web/dist/tano-web.global.js"></script>
<!-- window.TanoWeb.launch(…), window.TanoWeb.handleReturn() -->
```

## 1. Votre serveur crée la session

Avec `return_url` : une page de **votre** site (HTTPS, sans `?` ni `#`).

```ts
const session = await tano.sessions.create({
  case_id,
  return_url: "https://votre-site.example/verification/retour",
});
// renvoyez session.url à la page
```

## 2. La page ouvre le parcours, au clic

```ts
import { launch } from "@tano-africa/web";

bouton.addEventListener("click", async () => {
  const { url } = await fetch("/api/verification", { method: "POST" }).then((r) => r.json());
  launch({
    url,
    onReturn: () => rafraichirLeStatut(), // lisez le dossier côté serveur
  });
});
```

Le parcours s'ouvre dans une fenêtre. Si le navigateur la bloque, il s'ouvre dans l'onglet
(`fallbackToRedirect: false` pour l'interdire). `mode: "redirect"` l'ouvre toujours dans l'onglet.

## 3. La page de retour prévient l'onglet d'origine

```ts
import { handleReturn } from "@tano-africa/web";

const contexte = await handleReturn();
if (contexte === "popup") {
  // La fenêtre se ferme ; si le navigateur refuse, affichez « Vous pouvez fermer cette fenêtre ».
} else {
  // Le parcours avait été ouvert dans l'onglet même : affichez la suite ici.
}
```

## Ce que le SDK ne fait pas

Il ne transporte **aucun résultat** : un message de navigateur se falsifie. La décision se lit côté
serveur — webhook `case.decided`, ou `GET /v1/cases/{id}`.

Le parcours se coupe de la page qui l'a ouvert (`Cross-Origin-Opener-Policy`), pour qu'aucune page
tierce ne puisse le piloter : c'est pourquoi le retour passe par votre page, et pourquoi le SDK ne
sait pas si la personne ferme la fenêtre sans terminer. Le webhook vous le dira à l'expiration.
