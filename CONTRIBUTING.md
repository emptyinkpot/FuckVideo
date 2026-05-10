# Contributing

FuckVideo is the downstream AI video understanding and Remotion generation application in the emptyinkpot stack.

## Change Rules

- Keep Remotion Studio as the primary product entry.
- Do not bypass `visual-resolver.mjs` or `project-store.mjs` when adding material understanding or retrieval behavior.
- Keep generated videos, large footage, local caches and secrets out of Git.
- Update `project.json` and README/docs when pipeline contracts change.
- Use Sub2API-issued keys for hosted model and embedding access; do not commit raw provider keys.

## Validation

Use focused checks for touched areas:

```bash
npm run validate-animation-contracts
npm run test:material-vector-service
npm run test:material-seed
```

Also run:

```bash
git diff --check
```

## Commit Style

- `feat:` product behavior
- `fix:` bug fix
- `docs:` documentation or contracts
- `test:` tests
- `chore:` maintenance
