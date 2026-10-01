# Publier les SDK

Chaque registre a sa procédure. Les numéros de version se tiennent à jour dans les fichiers
indiqués ; une version publiée ne se republie jamais : on incrémente.

| Registre | Paquet | Version dans |
| --- | --- | --- |
| npm | `@tano-africa/node`, `/web`, `/react`, `/react-native` | `*/package.json` (+ `VERSION` de `node/src/client.ts`) |
| Swift Package Manager | `TanoSDK` | l'étiquette git semver nue (`0.1.0`) |
| Maven Central | `africa.tano:tano-android` | `android/tano/build.gradle.kts` (`coordinates`) |
| pub.dev | `tano_flutter` | `flutter/pubspec.yaml` |
| PyPI | `tano-sdk` | `python/pyproject.toml` (+ `VERSION` de `client.py`) |

Toujours depuis `main` à jour, avec un arbre propre :

```bash
git checkout main && git pull
```

## npm

Organisation `tano-africa`. Jeton Granular : *Packages and scopes* en lecture-écriture sur tous
les paquets, *Organizations → tano-africa* en lecture-écriture.

```bash
npm config set //registry.npmjs.org/:_authToken=<jeton>
pnpm install --frozen-lockfile
pnpm --filter @tano-africa/web publish          # d'abord : react en dépend
pnpm --filter @tano-africa/node publish
pnpm --filter @tano-africa/react publish
pnpm --filter @tano-africa/react-native publish
```

## Swift Package Manager

Rien à téléverser : Swift Package Manager lit le dépôt public et ses étiquettes. Le dépôt doit être
**public**. Une étiquette semver nue publie une version :

```bash
git tag 0.1.0 && git push origin 0.1.0
```

Les étiquettes semver nues sont réservées au paquet Swift ; les autres registres n'en dépendent pas.

## Maven Central

Une fois pour toutes :

1. Compte sur https://central.sonatype.com.
2. **Espace de noms `africa.tano`** : le portail donne un enregistrement **TXT** à ajouter au DNS de
   `tano.africa`, puis vérifie.
3. **Clé GPG** de signature :
   ```bash
   gpg --full-generate-key                       # RSA 4096, adresse de Qalebasse
   gpg --keyserver keyserver.ubuntu.com --send-keys <identifiant-de-clé>
   ```
4. **Jeton** du portail (*Account → Generate User Token*).
5. Dans `~/.gradle/gradle.properties` (jamais dans le dépôt) :
   ```properties
   mavenCentralUsername=<nom du jeton>
   mavenCentralPassword=<mot de passe du jeton>
   signingInMemoryKey=<clé privée ASCII : gpg --export-secret-keys --armor <id>, sur une ligne, sauts de ligne en \n>
   signingInMemoryKeyPassword=<phrase de passe de la clé>
   ```

À chaque version :

```bash
cd android && ./gradlew :tano:publishToMavenCentral
```

Puis, sur le portail, *Deployments* → vérifier → **Publish**. L'artefact apparaît sur Maven
Central en 10 à 30 minutes.

## pub.dev

Recommandé, une fois : un **éditeur vérifié** `tano.africa`. Vérifier le domaine dans Google
Search Console, puis *pub.dev → Create publisher*. Après la première publication, transférer le
paquet à cet éditeur (*Admin* du paquet).

```bash
cd flutter
flutter pub publish --dry-run
flutter pub publish                              # compte Google ; irréversible
```

## PyPI

Par Trusted Publishing : GitHub Actions publie, sans jeton. Une fois, sur pypi.org
(*Publishing → Add a new pending publisher*, onglet GitHub) : projet `tano-sdk`, propriétaire
`Qalebasse`, dépôt `tano-sdk`, workflow `publish-pypi.yml`, environnement `pypi`.

À chaque version, après avoir fusionné la version de `python/pyproject.toml` sur `main` :

```bash
git tag python-v0.1.0 && git push origin python-v0.1.0
```

Le workflow vérifie que l'étiquette correspond à la version, relance les tests, construit et publie.
