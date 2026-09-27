# Disaster Response Coordination Platform

A small backend-focused coordination system built as a Next.js App Router modular monolith. The project demonstrates durable disaster records, location resolution, PostGIS resource search, normalized community reports with Redis cache-aside, JWT authorization, and basic realtime updates. It is a take-home/demo implementation, not a production deployment blueprint.

## Architecture

HTTP handlers validate input and call module services. Services own application rules, data access is isolated behind repositories, and integrations are replaceable adapters. Optional dependencies are fault-contained: Redis/provider/realtime failure does not take down unrelated disaster APIs.

```mermaid
flowchart TB
  UI[Demo dashboard / API clients] --> API[Next App Router]
  UI -. Socket.IO .-> RT[Socket.IO server]
  API --> Auth[Authentication + policy]
  API --> Disaster[Disaster service]
  API --> Nearby[Resource service]
  API --> Reports[Reports service]
  Disaster --> Geo[LocationResolver]
  Disaster --> PG[(PostgreSQL + PostGIS)]
  Nearby --> PG
  Geo --> MockGeo[Deterministic offline resolver]
  Reports --> Provider[Provider interface]
  Provider --> Mock[Mock community provider]
  Reports --> Cache[Cache interface]
  Cache --> Redis[(Redis)]
  Disaster -. publish after commit .-> PubSub[Redis Pub/Sub]
  PubSub -. subscribe .-> RT
```

## Stack and features

- Next.js App Router, Node.js, strict TypeScript.
- PostgreSQL + PostGIS with Drizzle ORM and versioned SQL migrations.
- Redis cache-aside for external-style community reports.
- Zod request/config validation; Jose HS256 JWTs; bcryptjs password hashes.
- Socket.IO for `disaster_created` / `disaster_updated` notifications.
- Vitest for service, API boundary, provider/cache and optional PostGIS integration tests.
- Docker Compose local dependencies; minimal dashboard for demonstration.

## Local setup

Requirements: Node.js 20.9+ (Node 24 was used during implementation), npm, and Docker Compose.

```sh
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. `.env.example` and Compose credentials are for local development only. Change all credentials/secrets before any shared deployment. The app needs PostgreSQL; Redis is optional for request availability.

### Environment variables

| Variable                     | Purpose                             | Local example                                                                |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`               | PostgreSQL/PostGIS connection       | `postgres://disaster:disaster_dev_password@localhost:5432/disaster_response` |
| `REDIS_URL`                  | Optional report cache and realtime  | `redis://localhost:6379`                                                     |
| `JWT_SECRET`                 | HS256 signing key, minimum 32 chars | example contains local-only value                                            |
| `PORT`                       | HTTP and Socket.IO port             | `3000`                                                                       |
| `NODE_ENV`                   | Runtime mode                        | `development`                                                                |
| `REPORT_PROVIDER_TIMEOUT_MS` | Provider request deadline           | `1500`                                                                       |

### Database and seed

`npm run db:migrate` applies versioned migrations from `drizzle/`; it enables PostGIS and creates tables/indexes. `npm run db:seed` is idempotent and creates bcrypt-hashed development accounts plus representative disasters/resources. Seed passwords are local demo credentials, never production credentials:

- Admin: `admin@example.com` / `Admin123!`
- Contributor: `volunteer@example.com` / `Volunteer123!`

Run `docker compose down -v` only when you intentionally want to remove local database data.

## API overview

See [`API.md`](API.md) for request/response examples and errors. The disaster endpoints also remain available under `/api/disasters`.

| Method   | Path                                         | Auth                       |
| -------- | -------------------------------------------- | -------------------------- |
| `POST`   | `/api/auth/login`                            | Public                     |
| `GET`    | `/api/health`                                | Public                     |
| `POST`   | `/disasters`                                 | Admin or Contributor       |
| `GET`    | `/disasters`                                 | Public                     |
| `GET`    | `/disasters/:id`                             | Public                     |
| `PATCH`  | `/disasters/:id`                             | Admin or owner Contributor |
| `DELETE` | `/disasters/:id`                             | Admin                      |
| `GET`    | `/disasters/:id/resources?lat=&lng=&radius=` | Public                     |
| `GET`    | `/disasters/:id/reports`                     | Public                     |

Bearer token identity determines `created_by`; no API accepts a caller-supplied user identity. Disaster responses use `created_by`, `created_at`, and `updated_at`. Public reads keep response access simple. Contributors can update only records they created and cannot delete.

## Data model and geospatial query

`users` stores unique email, bcrypt hash and role. `disasters` stores title/description, location display name and `geography(Point,4326)`, tags, status, creator FK and timestamps. `resources` stores name/type and indexed geography location. Reports are not persisted. Constraints/enums and indexes are defined by the migration; resources have a GiST index.

Nearby search validates lat/lng and a positive radius capped at 100 km, then uses a parameterized PostGIS `ST_DWithin` predicate over geography. `ST_Distance` calculates returned distance and SQL orders results. No resource-wide application-side scan is used.

## Integrations, caching, and realtime

- `LocationResolver` is an interface. The local deterministic adapter recognizes a small documented list of place names, including Manhattan/NYC. An unknown place returns 422 rather than receiving guessed coordinates. Tests need no geocoder credentials.
- `CommunityReportProvider` is an interface with an external-shaped mock. Provider-specific data is normalized to `{content,user,created_at}`. A hard timeout is enforced.
- Reports use cache-aside with `community-reports:v1:<uuid>` and 60-second TTL. Redis errors are logged safely and treated as cache misses/write skips; a provider failure returns 502. Disaster CRUD does not depend on Redis.
- Socket.IO is attached to the custom Node server. Mutations publish to Redis Pub/Sub (`disaster-events:v1`) after DB commit; the server subscribes and emits to connected clients. Publication is best-effort and non-durable. HTTP state remains queryable if a socket client misses an event.
- Health endpoint distinguishes DB and Redis status. DB is required for data APIs; Redis is an optional accelerator for cache and realtime.

## Error handling and security

Zod validates JSON, query params, path IDs and configuration. Errors have stable codes and safe messages; unexpected internal errors are logged server-side without returning stack traces. SQL is parameterized, including the raw PostGIS statement. Passwords are hashed; acting identity is read only from a verified short-lived JWT. No provider/database secrets are included in responses or logs. The demo uses a simple bearer token and is not a complete identity-management system.

## Testing and commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
RUN_DB_INTEGRATION=1 npm test -- tests/integration/postgis.test.ts
```

The PostGIS integration test requires Compose services, applied migrations, and seed data. Vitest loads the local `.env` file; shell-provided values take precedence. Unit tests mock/inject external boundaries and do not require Docker.

## Technical decisions and trade-offs

PostgreSQL was selected for relational ownership and transactions; PostGIS handles indexed radius searches in the same store. The offline resolver and mock reports provider make local runs deterministic and require no API keys. Redis caches reports for 60 seconds and carries best-effort realtime events between Next route handlers and Socket.IO. The database remains authoritative, so a Redis outage does not undo disaster writes. These choices add local PostGIS and Redis setup but keep the application as one deployable.

## Assumptions, limitations, and scale evolution

- The demo resolver supports a finite gazetteer and is not intended for general geocoding.
- Seed credentials and Compose credentials are development-only.
- Realtime uses Redis Pub/Sub to bridge Next route handlers and the custom Socket.IO server; notifications are ephemeral and can be lost during Redis/subscriber outages. Durable notifications would need a transactional outbox/broker.
- Reports are ephemeral and may be fetched again after cache expiry. Real providers may require quotas, rate limiting, circuit breakers, retries/backoff, and stale-while-revalidate.
- Larger data volume may justify keyset pagination, query-plan-driven indexes, background work, audit logs, structured observability, and durable event processing.
- Database remains the only mandatory runtime data dependency. Offset pagination and development-only accounts keep this take-home simple; a larger deployment would need stronger identity and operational controls.

## AI-assisted development

Codex helped with coding, tests, documentation, and some design recommendations. I proposed the overall design and architecture, including the modular monolith, PostGIS-backed resource search, cache-aside reports, and the main failure boundaries. I also defined a representative Manhattan flooding scenario: a contributor creates an incident from a description, the system resolves its location, finds nearby resources, retrieves community reports, and sends a realtime update. I reviewed and refined the implementation against that flow and verified it with automated tests and a live smoke test.
