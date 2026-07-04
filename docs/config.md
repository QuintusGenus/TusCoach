# Configuration & Environment Variables

TusCoach uses [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) to load configuration from environment variables (and an optional `.env` file).

## Quick Start

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

## Environment Profiles

Set `ENV` to control the runtime profile:

| Value  | Behaviour |
|--------|-----------|
| `dev`  | Local development. Safe defaults are used for all settings. The app starts even if secrets are placeholder values. |
| `prod` | Production. **Strict startup validation** — the app refuses to start if `DATABASE_URL`, `JWT_SECRET`, or `REDIS_URL` still hold their dev-default values. |

## Variable Reference

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_NAME` | No | `TusCoach` | Display name used in API docs |
| `APP_VERSION` | No | `0.1.0` | Semver shown in `/health` |
| `ENV` | No | `dev` | `dev` or `prod` |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes (prod)** | `postgresql://tuscoach:tuscoach123@localhost:5433/tuscoach` | PostgreSQL connection string. In prod, must not point to the local dev database. |

### Redis / Celery

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | **Yes (prod)** | `redis://localhost:6379/0` | Used as both Celery broker and result backend. In prod, must not be the bare localhost default. |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes (prod)** | `dev-secret-change-in-production` | HMAC signing key for JWTs. Generate with `openssl rand -hex 32`. In prod, must not be the placeholder. |
| `JWT_ALG` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Token lifetime in minutes |

### LLM

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_PROVIDER` | No | `openai` | AI provider name |
| `LLM_API_KEY` | No | `""` | API key for the LLM provider. Required if AI coach features are enabled. |

### CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALLOWED_ORIGINS` | No | `["http://localhost:3000"]` | JSON list of allowed CORS origins |

### Push Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_ACCESS_TOKEN` | No | `""` | Expo push token. Optional — leave empty to send without auth. |
| `EXPO_PUSH_URL` | No | `https://exp.host/--/api/v2/push/send` | Expo push endpoint |

### Streak

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MIN_DAILY_MINUTES` | No | `10` | Minimum study minutes for a day to count toward the streak |

## Startup Validation (prod)

When `ENV=prod`, the app runs a Pydantic `model_validator` at startup that checks:

1. `DATABASE_URL` does not contain `localhost:5433` (the Docker Compose dev default).
2. `JWT_SECRET` is not the placeholder string `dev-secret-change-in-production`.
3. `REDIS_URL` is not the bare default `redis://localhost:6379/0`.

If any check fails, the process exits immediately with a clear error message listing every violation. This prevents accidentally running production with dev credentials.

## Generating a JWT Secret

```bash
openssl rand -hex 32
# Example output: a3f8c1d9e7b24f6a8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2
```

Paste the output into your `.env`:

```
JWT_SECRET=a3f8c1d9e7b24f6a8c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2
```
