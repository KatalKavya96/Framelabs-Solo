# FrameLabs

FrameLabs is a full-stack collaborative engineering diagram workspace. The current implementation provides a production-shaped vertical slice for architecture diagrams: React Flow visual editing, a synchronized diagram DSL, Prisma persistence, immutable version history, sharing, comments, exports, and Socket.IO collaboration.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
npm --prefix client install
npm --prefix server install
cp server/.env.example server/.env
npm run db:setup
npm run dev
```

The API runs on `http://127.0.0.1:5001`. Vite prints the available web URL (normally `http://localhost:5173`). Demo credentials are `alex@framelabs.dev` / `framelabs-demo`; the development UI also falls back to the seeded demo user when no token is present.

## Commands

- `npm run dev` — run API and web client together.
- `npm run build` — type-check and build both applications.
- `npm run db:setup` — generate Prisma Client, apply migrations, and seed the demo workspace.
- `npm run db:seed` — idempotently refresh demo records.
- `npm --prefix server run db:migrate -- --name <name>` — create a development migration.

## Implemented product flows

- Organization → workspace → project → diagram hierarchy.
- Architecture, database, sequence, class, and flow workspace types in the persisted domain model.
- Two-way DSL and visual node synchronization.
- Typed components, semantic metadata, smart React Flow connections, drag and reconnect behavior.
- Explicit save plus debounced autosave with optimistic revision checks.
- Immutable, attributed versions; preview, navigate, and restore without rewriting history.
- Public/team share links with view/edit permissions and optional server-side expiry support.
- Live room presence, cursor events, diagram updates, comments, reconnect behavior, and visible conflict resolution.
- PNG, SVG, PDF, DSL, JSON, and Markdown exports.
- User registration/login and diagram collaborator access records.

SQLite is used for the self-contained local environment. The Prisma schema is intentionally relational and can be moved to PostgreSQL for production. See [Architecture](docs/ARCHITECTURE.md) and [API](docs/API.md).
