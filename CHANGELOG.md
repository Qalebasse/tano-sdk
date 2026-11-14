# Journal des versions des paquets npm

## 0.4.0 — `@tano-africa/node` (et `tano-sdk` 0.4.0 sur PyPI)

- Groupes de signataires : une place de `signers[]` peut être tenue par un groupe, `group_name`
  et `members` (de 2 à 10 membres, chacun avec son nom, son contact et `auth_method`) à la place
  de la personne ; `role`, `position`, `fields`, `hidden_documents`, `delivery`, `custom_text` et
  `redirect_urls` restent sur la place. Aussi dans une demande tirée d'un modèle.
- En Node, `SignerParams` devient `PersonSignerParams | GroupSignerParams`, et
  `TemplateSignerParams` `TemplatePersonSignerParams | TemplateGroupSignerParams` : une place
  ne mêle pas une personne et un groupe. En Python, `PersonSigner`, `GroupSigner` et
  `GroupMember` décrivent ces places pour un vérificateur de types.
- Le premier membre qui signe tient la place ; les autres passent au nouveau statut
  `released` (webhook `signer.released`). Un membre qui refuse refuse la demande.
- Chaque signataire de la réponse porte `group` : `{ id, name }` pour un membre, `null` sinon.
- L'en-tête `User-Agent` annonce `tano-node/0.4.0` et `tano-python/0.4.0`.

Aucun changement sur la vérification d'identité.

## 0.3.0 — `@tano-africa/node` (et `tano-sdk` 0.3.0 sur PyPI)

- Modèles de signature : `signatureTemplates` (`signature_templates` en Python) — enregistrer un
  modèle (documents, rôles et leurs champs), le lister, le lire, le supprimer, télécharger un de
  ses PDF (`document`).
- Une demande se tire d'un modèle : `template_id` dans `signatureRequests.create`, avec une
  personne par rôle ; `name` devient facultatif et `documents` ne s'envoie pas. La réponse porte
  `template_id`. Raccourci : `signatureTemplates.createRequest` (`create_request` en Python).
- Documents cachés : `signers[].hidden_documents`, les indices des documents qu'un signataire ne
  voit pas ; la réponse rend leurs identifiants (`sd_…`).
- L'en-tête `User-Agent` annonce `tano-node/0.3.0` et `tano-python/0.3.0`.

Aucun changement sur la vérification d'identité.

## 0.2.0 — `@tano-africa/node` (et `tano-sdk` 0.2.0 sur PyPI)

- Signature électronique : `signatureRequests` (`signature_requests` en Python) — créer et
  envoyer une demande, la lire, la lister, l'activer, l'annuler, supprimer un brouillon, obtenir
  le lien d'un signataire, télécharger le document signé et le fichier de preuve.
- Cachet électronique : `seals` — profils, scellement, lecture, téléchargement.
- `documents.verify` : les signatures et cachets d'un PDF, et leur intégrité.
- Bac à sable : `sandbox.sign` et `sandbox.decline` simulent la réponse d'un signataire.
- Champs : les types `radio`, `signer_name`, `signer_email` et `read_only_text`, et les options de
  chaque type (`label`, `max_length`, `default_value`, `date_format`, `layout`, `reason`, `group`,
  `value`, `name_format`, `text`). Les ancres du PDF (`{{s1|signature}}`) posent les champs sans
  coordonnées ; `signers[].fields` les rend.
- Parcours du signataire : `delivery` (`email` ou `none`), `custom_text` (textes de l'invitation et
  de la relance), `redirect_urls` (retours après signature, refus, erreur), sur la demande et par
  signataire ; `signatureRequests.remind` (`signature_requests.remind`) relance à la main.
- Gestion d'une demande en cours : `metadata` (jointes aux webhooks), `update` (métadonnées, report
  de l'échéance), `reactivate` (une demande expirée repart), `updateSigner` (`update_signer` en
  Python) pour corriger un signataire.
- `@tano-africa/web` 0.2.0 : `mountSigning` affiche la page de signature dans votre page, avec ses
  événements (`onStep`, `onSigned`, `onDeclined`, `onEnded`), dans un cadre de hauteur fixe
  (`height`).
- Les PDF s'envoient en octets ; le SDK les encode en base 64. Un téléchargement rend un
  `PdfFile` : les octets, l'empreinte, la version signée ou non, le spécimen de bac à sable.
- L'en-tête `User-Agent` annonce `tano-node/0.2.0` et `tano-python/0.2.0`.

Aucun changement sur la vérification d'identité.

## 0.1.1

- README réécrits pour la production, en français : installation, démarrage rapide, référence
  complète de l'API, événements, erreurs, sécurité.
- Descriptions des paquets en français.
- `@tano-africa/node` : l'en-tête `User-Agent` annonce `tano-node/0.1.1`.

Aucun changement d'API.

## 0.1.0

- Première version : `@tano-africa/node`, `@tano-africa/web`, `@tano-africa/react`,
  `@tano-africa/react-native`.
