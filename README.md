# tano-sdk

Les SDK de [Tano](https://docs.tano.africa).

| Paquet | Pour | Dossier |
| --- | --- | --- |
| `@tano-africa/node` | votre serveur Node.js | [node](node) |
| `tano-sdk` | votre serveur Python | [python](python) |
| `@tano-africa/web` | votre site : ouvrir le parcours | [web](web) |

L'intégration type : le **serveur** ouvre un dossier et une session (clé d'API, signature) ; le
**navigateur** ouvre le parcours avec l'URL de la session ; la **décision** arrive au serveur par
webhook.

## Développer

```bash
pnpm install && pnpm lint && pnpm types && pnpm test && pnpm build
cd python && uv sync && uv run ruff check . && uv run mypy && uv run pytest
```

Les signatures sont testées contre des vecteurs calculés par `tano-core` : un changement de l'un
sans l'autre casse les tests.
