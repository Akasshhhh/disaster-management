# HTTP and Realtime API

Base URL for local use: `http://localhost:3000`. JSON request bodies use `Content-Type: application/json`. UUIDs must be valid UUIDs. Authentication uses `Authorization: Bearer <token>`. The disaster endpoints are also available under `/api/disasters` for compatibility with existing API clients.

## Login

`POST /api/auth/login`

```json
{ "email": "admin@example.com", "password": "Admin123!" }
```

Response `200`:

```json
{
  "token": "<signed-jwt>",
  "token_type": "Bearer",
  "expires_in": 7200,
  "user": { "id": "<uuid>", "email": "admin@example.com", "role": "ADMIN" }
}
```

Invalid credentials return `401 INVALID_CREDENTIALS`. The seeded password is development-only.

## Disasters

- `GET /disasters?tag=flood&status=active&page=1&limit=20` — public list. `page` starts at 1; limit is 1–100. Response includes `items` (disaster objects), `page`, `limit`, and `total`.
- `GET /disasters/:id` — public detail.
- `POST /disasters` — authenticated Admin or Contributor.

```json
{
  "title": "Manhattan flash flooding",
  "description": "Flooded streets around Manhattan, NYC after rainfall.",
  "tags": ["flood", "storm"],
  "status": "active"
}
```

`created_by` is always derived from the token. Location is resolved from the description. Successful creation returns `201` and emits `disaster_created` after commit.

- `PATCH /disasters/:id` — Admin or creator Contributor; accepts one or more of `title`, `description`, `tags`, `status`. If description changes, its location is resolved again.
- `DELETE /disasters/:id` — Admin only; successful deletion returns `204`.

Disaster responses, including entries in the list, use this shape:

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "title": "Manhattan flash flooding",
  "description": "Flooded streets around Manhattan, NYC after rainfall.",
  "location": {
    "name": "Manhattan, New York City",
    "latitude": 40.7831,
    "longitude": -73.9712
  },
  "tags": ["flood", "storm"],
  "status": "active",
  "created_by": "<authenticated-user-uuid>",
  "created_at": "2026-01-15T12:00:00.000Z",
  "updated_at": "2026-01-15T12:00:00.000Z"
}
```

Statuses are `active`, `contained`, and `resolved`. An unresolved description returns `422 LOCATION_UNRESOLVED` without creating or updating a record.

## Nearby resources

`GET /disasters/:id/resources?lat=40.7831&lng=-73.9712&radius=10&type=shelter`

- `lat`: -90 to 90; `lng`: -180 to 180. Both are required and must be non-empty numbers.
- `radius`: positive km, maximum 100.
- `type` optional: `shelter`, `hospital`, `food`, `water`, `rescue`.
- Response: `{ "resources": [{ "id", "name", "type", "location", "distanceKm" }], "count" }`.

PostGIS geography and `ST_DWithin` perform radius filtering; results are ordered by SQL-computed distance.

## Community reports

`GET /disasters/:id/reports`

Response: `{ "reports": [{ "content": "...", "user": "...", "created_at": "..." }] }`. Data is normalized from the provider contract and cached for 60 seconds. Provider failures without cached results return `502`.

## Health and realtime

- `GET /api/health` returns each dependency as `ok`, `degraded`, or `unavailable`. PostgreSQL failure returns 503; Redis degradation returns 200 because cache is optional.
- Socket.IO uses `/socket.io`; listen for `disaster_created` and `disaster_updated`. The payload uses the disaster response shape above. No authentication is required for this demo stream.

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Query validation failed.",
    "details": { "lat": ["Too big: expected number to be <=90"] }
  }
}
```

Common codes/statuses: malformed or invalid request `400`; unauthenticated `401`; forbidden `403`; missing entity `404`; unresolved location `422`; provider unavailable/timeout `502`; unexpected error `500`; database unavailable `503`. Internal stack/database/provider details are not returned.
