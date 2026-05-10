# Security Policy

FuckVideo handles media files, generated projects and model provider access. It must not store live credentials.

## Do Not Commit

- Sub2API keys
- DashScope/OpenAI/GLM/provider keys
- generated `.env` files
- private source material that should remain local
- large generated renders unless explicitly intended
- screenshots or logs containing keys

## Provider Access

Hosted model and embedding access should go through Sub2API:

```env
MATERIAL_EMBEDDING_API_BASE_URL=https://<private-sub2api-host>/v1
MATERIAL_EMBEDDING_API_KEY_ENV=SUB2API_API_KEY
```

Raw provider keys belong in `.env.local`, server secret stores, or Sub2API upstream account credentials.

## Sensitive Media

Treat local footage and generated project JSON as potentially sensitive. Do not publish private footage, voice assets, or generated outputs without an explicit release decision.
