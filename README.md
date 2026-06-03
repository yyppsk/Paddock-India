# Paddock India Spa Scroll

A Node-served Vite + Three.js scroll experience where the car races around a real track model with day/night lighting and weather controls.

## Structure

```text
backend/
  src/                  Node HTTP server and API endpoints
  public/app/           Generated frontend build, ignored by Git
frontend/
  src/                  Three.js scene
  public/               GLB, Draco, and texture assets
screenshots/            Local visual-check screenshots, ignored by Git
```

## Local Run

```bash
corepack enable
yarn install
yarn build
yarn start
```

The Node server listens on `http://localhost:3000` by default and serves the built frontend from `backend/public/app`.

If you prefer npm, `npm install`, `npm run build`, and `npm start` also work.

For Vite-only frontend iteration:

```bash
yarn dev:frontend
```

## API

- `GET /api/health`
- `GET /api/config`
- `GET /api/content/public`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/verify-email`
- `GET /api/admin/content`
- `POST /api/admin/content`
- `PATCH /api/admin/content/:id`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`

The public content endpoint falls back to built-in sections when Postgres is not configured. Auth and admin endpoints require Postgres.

## Environment

Copy `.env.example` into your deployment environment and set values there.

```text
PORT=3001
APP_PORT=3001
POSTGRES_DB=paddockindia
POSTGRES_USER=userpaddockindiaprod
POSTGRES_PASSWORD=change-this-password
POSTGRES_PORT=5432
DATABASE_URL=
DATABASE_SSL=false
RUN_MIGRATIONS_ON_START=true
SUPER_ADMIN_EMAILS=you@example.com
COOKIE_SECURE=true
REQUIRE_SMTP=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Paddock India <no-reply@example.com>"
```

`docker-compose.yml` includes a `postgres:16-alpine` service with a persistent `paddockindia_postgres_data` volume. Postgres is only published on `127.0.0.1:${POSTGRES_PORT:-5432}` for local access; the app talks to it internally through the `postgres` service name.

Set `DATABASE_URL` only if you want to override the bundled Compose database with an external managed Postgres instance.

Run migrations manually when needed:

```bash
docker compose exec app npm run migrate
```

By default the server also runs pending migrations at startup when `DATABASE_URL` is configured. Set `RUN_MIGRATIONS_ON_START=false` to disable that.

The first super admin is created by signing up with an email listed in `SUPER_ADMIN_EMAILS`. Public signup users otherwise receive the `user` role. Promote additional admins from `/admin`.

SMTP uses the same environment shape as the referenced projects: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SEND_TIMEOUT_MS`, `MAIL_FROM`, and `REQUIRE_SMTP`. Keep real credentials in deployment secrets only.

## Docker

```bash
docker build -t paddockindia-spa-scroll .
docker run --rm -p 3001:3001 --env-file .env paddockindia-spa-scroll
```

Or with Compose:

```bash
docker compose up --build
docker compose exec postgres psql -U userpaddockindiaprod -d paddockindia
```

## Dokploy

Use Compose mode if you want Dokploy to run both the app and bundled Postgres. Point the domain to service `app`, container port `3001`.

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
APP_PORT=3001
POSTGRES_DB=paddockindia
POSTGRES_USER=userpaddockindiaprod
POSTGRES_PASSWORD=<secure password>
DATABASE_SSL=false
RUN_MIGRATIONS_ON_START=true
SUPER_ADMIN_EMAILS=<comma separated admin emails>
COOKIE_SECURE=true
```

If you use an external Postgres service instead, set `DATABASE_URL=<external postgres url>` and `DATABASE_SSL=true` as needed.

## Fly

`fly.toml` is included for Docker-based Fly deployment. Before deploying, change the `app` value if `paddockindia-spa-scroll` is not available in your Fly account.

```bash
fly deploy
```

Set secrets on Fly instead of committing them:

```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set DATABASE_SSL="true"
```

## Assets

- Car: `frontend/public/models/ferrari.glb`.
- Active track: `frontend/public/models/real track/source/track.glb`.
- Version 1 and Version 3 backup code/assets remain under `backup/version-1-and-3/` and are not imported by the active app.
