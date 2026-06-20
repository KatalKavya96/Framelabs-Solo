# System architecture

## Components

- `client/`: React 19, TypeScript, Vite, React Flow, Socket.IO client, html-to-image, jsPDF.
- `server/`: Express 5, Prisma, SQLite, Zod, JWT authentication, Socket.IO.
- `server/prisma/`: relational schema, migration history, and idempotent seed.

## Diagram consistency model

`Diagram` is the current read model. It stores DSL, serialized visual model, type, tags, and a monotonically increasing `revision`. `DiagramVersion` is append-only and stores each accepted state with actor, summary, revision, and version number.

Every REST or WebSocket save:

1. Checks access and validates payload size and shape.
2. Compares `baseRevision` with the persisted revision.
3. Uses a conditional update inside a transaction.
4. Creates the immutable version in the same transaction.
5. Broadcasts the accepted server state to the diagram room.

Conflicting changes receive HTTP/Socket conflict data containing the current server revision. The client keeps its local state intact and asks the editor to choose the collaborator state or resubmit the local state. This prevents silent data loss. For very high-frequency text collaboration, the natural next production step is CRDT operations (for example Yjs) rather than full-document payloads.

## Collaboration

Socket rooms are keyed by diagram ID. Presence and cursor data are ephemeral; accepted diagram state and comments are durable. Socket saves and REST saves call the same `saveDiagram` service. REST restores are also broadcast, so every connected client converges on the restored revision.

For horizontal scaling, replace the process-local presence map with Redis and add the Socket.IO Redis adapter. PostgreSQL should replace SQLite. A durable queue/outbox should publish committed version events when running multiple API instances.

## Scale and reliability

- Database indexes cover hierarchy reads, version timelines, collaborators, comments, and tokens.
- Payload limits protect API and socket processes.
- The canvas is viewport-rendered by React Flow; large diagrams should additionally use spatial partitioning and collapsed groups.
- Long-term versions are separate rows and never overwritten.
- Share tokens are random 160-bit values and can be revoked or expired.
- Passwords are bcrypt-hashed and JWTs expire after seven days.

Production deployment must provide a strong `JWT_SECRET`, TLS, PostgreSQL, object storage for large exports, rate limiting, structured logs, monitoring, backup/restore procedures, and a Redis-backed Socket.IO adapter.
