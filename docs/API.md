# API reference

Base path: `/api`. Requests may use `Authorization: Bearer <jwt>`. Local development defaults to `demo-user` when no token is provided.

## Authentication and hierarchy

- `POST /auth/register`, `POST /auth/login`
- `GET|POST /organizations`
- `POST /organizations/:organizationId/workspaces`
- `POST /workspaces/:workspaceId/projects`
- `GET /projects/:projectId/diagrams`
- `GET /bootstrap`, `GET /search?q=...`

## Diagrams and versions

- `POST /diagrams`
- `GET|PUT /diagrams/:diagramId`
- `GET /diagrams/:diagramId/versions`
- `GET /diagrams/:diagramId/versions/:versionId`
- `POST /diagrams/:diagramId/versions/:versionId/restore`

Save requests contain `dsl`, `model`, `baseRevision`, `type`, title/description/tags, and a summary. A stale `baseRevision` returns `409` with the authoritative diagram while retaining the caller's local work in the frontend.

## Sharing, collaborators, and comments

- `GET|POST /diagrams/:diagramId/share-links`
- `DELETE /diagrams/:diagramId/share-links/:shareId`
- `GET /shared/:token`
- `POST /diagrams/:diagramId/collaborators`
- `GET|POST /diagrams/:diagramId/comments`
- `PATCH /diagrams/:diagramId/comments/:commentId`

## Export

`GET /diagrams/:diagramId/export?format=dsl|json|markdown`. PNG, SVG, and PDF are rendered from the live canvas in the web client.

## WebSocket events

- Client: `join:diagram`, `diagram:change`, `cursor:update`
- Server: `presence:updated`, `diagram:updated`, `version:created`, `cursor:updated`, `comment:created`

`diagram:change` uses acknowledgements with `{ ok, revision }` or `{ ok:false, error, current }` for optimistic conflict handling.
