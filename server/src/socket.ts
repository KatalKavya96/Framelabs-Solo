import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "./auth.js";
import { config } from "./config.js";
import { ConflictError, decodeDiagram, ensureDiagramAccess, saveDiagram, type SaveDiagramInput } from "./diagramService.js";

type Presence = { socketId: string; userId: string; name: string; color: string; cursor?: { x: number; y: number } };
type JoinPayload = { diagramId: string; name?: string; color?: string };
type ChangePayload = SaveDiagramInput & { diagramId: string; clientId: string; operationId: string };
type Ack = (result: { ok: boolean; revision?: number; error?: string; current?: unknown }) => void;

const rooms = new Map<string, Map<string, Presence>>();

export function attachSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientOrigins, credentials: true }, maxHttpBufferSize: 6_000_000, transports: ["websocket", "polling"] });
  io.use((socket, next) => {
    const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
    socket.data.userId = verifyToken(token) ?? "demo-user";
    next();
  });

  io.on("connection", socket => {
    socket.on("join:diagram", async (payload: JoinPayload, acknowledge?: Ack) => {
      try {
        await ensureDiagramAccess(payload.diagramId, socket.data.userId as string);
        if (socket.data.diagramId) leaveRoom(io, socket.data.diagramId as string, socket.id);
        socket.data.diagramId = payload.diagramId;
        await socket.join(`diagram:${payload.diagramId}`);
        const presence: Presence = { socketId: socket.id, userId: socket.data.userId as string, name: payload.name?.slice(0, 80) || "Alex Morgan", color: payload.color || "#04cbb0" };
        const room = rooms.get(payload.diagramId) ?? new Map<string, Presence>();
        room.set(socket.id, presence); rooms.set(payload.diagramId, room);
        io.to(`diagram:${payload.diagramId}`).emit("presence:updated", [...room.values()]);
        acknowledge?.({ ok: true });
      } catch (error) { acknowledge?.({ ok: false, error: error instanceof Error ? error.message : "Unable to join" }); }
    });

    socket.on("diagram:change", async (payload: ChangePayload, acknowledge?: Ack) => {
      try {
        const result = await saveDiagram(payload.diagramId, socket.data.userId as string, payload);
        const diagram = decodeDiagram(result.diagram);
        socket.to(`diagram:${payload.diagramId}`).emit("diagram:updated", { diagram, operationId: payload.operationId, clientId: payload.clientId, actor: socket.data.userId });
        io.to(`diagram:${payload.diagramId}`).emit("version:created", result.version);
        acknowledge?.({ ok: true, revision: result.diagram.revision });
      } catch (error) {
        if (error instanceof ConflictError) acknowledge?.({ ok: false, error: error.message, current: decodeDiagram(error.current) });
        else acknowledge?.({ ok: false, error: error instanceof Error ? error.message : "Save failed" });
      }
    });

    socket.on("cursor:update", (cursor: { x: number; y: number }) => {
      const diagramId = socket.data.diagramId as string | undefined;
      const presence = diagramId ? rooms.get(diagramId)?.get(socket.id) : undefined;
      if (!diagramId || !presence || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return;
      presence.cursor = cursor;
      socket.volatile.to(`diagram:${diagramId}`).emit("cursor:updated", presence);
    });

    socket.on("comment:created", (comment: unknown) => {
      const diagramId = socket.data.diagramId as string | undefined;
      if (diagramId) socket.to(`diagram:${diagramId}`).emit("comment:created", comment);
    });

    socket.on("disconnect", () => {
      const diagramId = socket.data.diagramId as string | undefined;
      if (diagramId) leaveRoom(io, diagramId, socket.id);
    });
  });
  return io;
}

function leaveRoom(io: Server, diagramId: string, socketId: string) {
  const room = rooms.get(diagramId); room?.delete(socketId);
  if (!room?.size) rooms.delete(diagramId);
  io.to(`diagram:${diagramId}`).emit("presence:updated", room ? [...room.values()] : []);
}
