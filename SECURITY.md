# Politique de sécurité

## Signaler une vulnérabilité

**N'ouvrez pas de ticket public.** Écrivez à **security@tano.africa**, avec :

- le paquet et la version concernés ;
- la description du problème et son impact ;
- les étapes pour le reproduire, et une preuve de concept si vous en avez une.

Nous accusons réception sous 2 jours ouvrés, et nous vous tenons informé jusqu'à la correction.
Nous vous demandons de ne pas divulguer la faille avant la publication d'un correctif, et nous
vous créditons si vous le souhaitez.

## Versions prises en charge

Les correctifs de sécurité sont publiés sur la dernière version de chaque paquet.

| Paquet | Version prise en charge |
| --- | --- |
| `@tano-africa/node`, `/web`, `/react`, `/react-native` | dernière 0.x |
| `tano-sdk` (PyPI) | dernière 0.x |
| `africa.tano:tano-android` | dernière 0.x |
| `tano_flutter` | dernière 0.x |
| `TanoSDK` (Swift Package Manager) | dernière 0.x |

## Périmètre

Ce dépôt contient les bibliothèques clientes de Tano. Les failles de l'API, du parcours de
vérification ou de la console se signalent à la même adresse.

Rappel du modèle de sécurité : les clés d'API restent sur votre serveur et ne doivent jamais être
embarquées dans une application ou une page web. Les SDK clients ne transportent aucun résultat
de vérification : la décision se lit côté serveur.
