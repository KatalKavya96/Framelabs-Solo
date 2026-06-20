import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Server } from "socket.io";
import { z } from "zod";
import { authenticate, authUser, issueToken } from "./auth.js";
import { prisma } from "./db.js";
import { AccessError, ConflictError, createDiagram, decodeDiagram, ensureDiagramAccess, restoreVersion, saveDiagram } from "./diagramService.js";
import { commentSchema, createDiagramSchema, saveDiagramSchema, shareSchema } from "./schemas.js";

export const api = Router();

api.get("/health", (_request, response) => response.json({ ok: true, service: "framelabs-api", timestamp: new Date().toISOString() }));

api.post("/auth/register", async (request, response) => {
  const input = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email(), password: z.string().min(8).max(200) }).parse(request.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const suffix = randomBytes(3).toString("hex");
  const user = await prisma.user.create({
    data: {
      name: input.name, email: input.email.toLowerCase(), passwordHash,
      memberships: { create: { role: "OWNER", organization: { create: { name: `${input.name}'s Organization`, slug: `org-${suffix}`, workspaces: { create: { name: "My Workspace", slug: "main", projects: { create: { name: "Getting Started", slug: "getting-started", description: "Your first Framelabs project" } } } } } } } },
    }, select: { id: true, name: true, email: true, avatarUrl: true },
  });
  response.status(201).json({ user, token: issueToken(user) });
});

api.post("/auth/login", async (request, response) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return response.status(401).json({ error: "Invalid email or password" });
  response.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }, token: issueToken(user) });
});

api.use(authenticate);

api.get("/bootstrap", async (request, response) => {
  const userId = authUser(request);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, avatarUrl: true } });
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { organization: { include: { workspaces: { include: { projects: { include: { diagrams: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, description: true, type: true, revision: true, updatedAt: true } } } } } } } } },
    orderBy: { createdAt: "asc" },
  });
  const availableDiagrams = memberships[0]?.organization.workspaces[0]?.projects[0]?.diagrams ?? [];
  const firstDiagramId = availableDiagrams.find(diagram => diagram.type === "ARCHITECTURE")?.id ?? availableDiagrams[0]?.id;
  const diagram = firstDiagramId ? await prisma.diagram.findUnique({ where: { id: firstDiagramId } }) : null;
  response.json({ user, organizations: memberships.map(item => ({ role: item.role, ...item.organization })), diagram: diagram ? decodeDiagram(diagram) : null });
});

api.get("/organizations", async (request, response) => {
  const memberships = await prisma.membership.findMany({ where: { userId: authUser(request) }, include: { organization: { include: { workspaces: { include: { projects: true } } } } } });
  response.json(memberships.map(item => ({ ...item.organization, role: item.role })));
});

api.post("/organizations", async (request, response) => {
  const input = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9-]+$/).max(80) }).parse(request.body);
  const organization = await prisma.organization.create({ data: { ...input, memberships: { create: { userId: authUser(request), role: "OWNER" } } } });
  response.status(201).json(organization);
});

api.post("/organizations/:organizationId/workspaces", async (request, response) => {
  const input = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9-]+$/).max(80) }).parse(request.body);
  const membership = await prisma.membership.findUnique({ where: { userId_organizationId: { userId: authUser(request), organizationId: request.params.organizationId! } } });
  if (!membership) throw new AccessError("Organization access denied");
  response.status(201).json(await prisma.workspace.create({ data: { ...input, organizationId: request.params.organizationId! } }));
});

api.post("/workspaces/:workspaceId/projects", async (request, response) => {
  const input = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9-]+$/).max(80), description: z.string().max(1000).optional() }).parse(request.body);
  const workspace = await prisma.workspace.findFirst({ where: { id: request.params.workspaceId!, organization: { memberships: { some: { userId: authUser(request) } } } } });
  if (!workspace) throw new AccessError("Workspace access denied");
  response.status(201).json(await prisma.project.create({ data: { ...input, workspaceId: workspace.id } }));
});

api.get("/projects/:projectId/diagrams", async (request, response) => {
  const diagrams = await prisma.diagram.findMany({ where: { projectId: request.params.projectId!, project: { workspace: { organization: { memberships: { some: { userId: authUser(request) } } } } } }, orderBy: { updatedAt: "desc" } });
  response.json(diagrams.map(decodeDiagram));
});

api.post("/diagrams", async (request, response) => {
  const input = createDiagramSchema.parse(request.body);
  const result = await createDiagram(input, authUser(request));
  response.status(201).json({ diagram: decodeDiagram(result.diagram), version: result.version });
});

api.get("/diagrams/:diagramId", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  const diagram = await prisma.diagram.findUniqueOrThrow({ where: { id: request.params.diagramId! }, include: { updatedBy: { select: { id: true, name: true, avatarUrl: true } }, _count: { select: { versions: true, comments: true } } } });
  response.json(decodeDiagram(diagram));
});

api.put("/diagrams/:diagramId", async (request, response) => {
  const input = saveDiagramSchema.parse(request.body);
  const result = await saveDiagram(request.params.diagramId!, authUser(request), input);
  if (!result.unchanged) {
    const io = request.app.get("io") as Server | undefined;
    io?.to(`diagram:${request.params.diagramId!}`).emit("diagram:updated", { diagram: decodeDiagram(result.diagram), operationId: `rest-${result.diagram.revision}`, clientId: "rest-api", actor: authUser(request) });
    io?.to(`diagram:${request.params.diagramId!}`).emit("version:created", result.version);
  }
  response.json({ diagram: decodeDiagram(result.diagram), version: result.version, unchanged: result.unchanged });
});

api.get("/diagrams/:diagramId/versions", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  const versions = await prisma.diagramVersion.findMany({ where: { diagramId: request.params.diagramId! }, orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, revision: true, title: true, summary: true, createdAt: true, actor: { select: { id: true, name: true, avatarUrl: true } } } });
  response.json(versions);
});

api.get("/diagrams/:diagramId/versions/:versionId", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  const version = await prisma.diagramVersion.findFirstOrThrow({ where: { id: request.params.versionId!, diagramId: request.params.diagramId! }, include: { actor: { select: { id: true, name: true, avatarUrl: true } } } });
  response.json({ ...version, model: JSON.parse(version.modelJson), modelJson: undefined });
});

api.post("/diagrams/:diagramId/versions/:versionId/restore", async (request, response) => {
  const result = await restoreVersion(request.params.diagramId!, request.params.versionId!, authUser(request));
  const io = request.app.get("io") as Server | undefined;
  io?.to(`diagram:${request.params.diagramId!}`).emit("diagram:updated", { diagram: decodeDiagram(result.diagram), operationId: `restore-${result.diagram.revision}`, clientId: "rest-api", actor: authUser(request) });
  io?.to(`diagram:${request.params.diagramId!}`).emit("version:created", result.version);
  response.json({ diagram: decodeDiagram(result.diagram), version: result.version });
});

api.get("/diagrams/:diagramId/share-links", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request), true);
  response.json(await prisma.shareLink.findMany({ where: { diagramId: request.params.diagramId! }, orderBy: { createdAt: "desc" } }));
});

api.post("/diagrams/:diagramId/share-links", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request), true);
  const input = shareSchema.parse(request.body);
  const share = await prisma.shareLink.create({ data: { diagramId: request.params.diagramId!, createdById: authUser(request), token: randomBytes(20).toString("base64url"), permission: input.permission, scope: input.scope, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } });
  response.status(201).json(share);
});

api.delete("/diagrams/:diagramId/share-links/:shareId", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request), true);
  await prisma.shareLink.deleteMany({ where: { id: request.params.shareId!, diagramId: request.params.diagramId! } });
  response.status(204).end();
});

api.get("/shared/:token", async (request, response) => {
  const share = await prisma.shareLink.findUnique({ where: { token: request.params.token! }, include: { diagram: true } });
  if (!share || (share.expiresAt && share.expiresAt < new Date())) return response.status(404).json({ error: "Share link not found or expired" });
  if (share.scope === "TEAM") await ensureDiagramAccess(share.diagramId, authUser(request));
  response.json({ permission: share.permission, scope: share.scope, diagram: decodeDiagram(share.diagram) });
});

api.post("/diagrams/:diagramId/collaborators", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request), true);
  const input = z.object({ email: z.string().email(), permission: z.enum(["VIEW", "EDIT"]).default("EDIT") }).parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) return response.status(404).json({ error: "User not found" });
  const collaborator = await prisma.diagramCollaborator.upsert({ where: { diagramId_userId: { diagramId: request.params.diagramId!, userId: user.id } }, create: { diagramId: request.params.diagramId!, userId: user.id, permission: input.permission }, update: { permission: input.permission }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } });
  response.status(201).json(collaborator);
});

api.get("/diagrams/:diagramId/collaborators", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  response.json(await prisma.diagramCollaborator.findMany({ where: { diagramId: request.params.diagramId! }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } }));
});

api.get("/diagrams/:diagramId/comments", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  response.json(await prisma.comment.findMany({ where: { diagramId: request.params.diagramId! }, include: { author: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } }));
});

api.post("/diagrams/:diagramId/comments", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  const input = commentSchema.parse(request.body);
  const comment = await prisma.comment.create({ data: { diagramId: request.params.diagramId!, authorId: authUser(request), body: input.body, nodeId: input.nodeId, x: input.x, y: input.y }, include: { author: { select: { id: true, name: true, avatarUrl: true } } } });
  const io = request.app.get("io") as Server | undefined;
  io?.to(`diagram:${request.params.diagramId!}`).emit("comment:created", comment);
  response.status(201).json(comment);
});

api.patch("/diagrams/:diagramId/comments/:commentId", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  const input = z.object({ resolved: z.boolean() }).parse(request.body);
  const result = await prisma.comment.updateMany({ where: { id: request.params.commentId!, diagramId: request.params.diagramId! }, data: input });
  if (!result.count) return response.status(404).json({ error: "Comment not found" });
  response.json({ ok: true });
});

api.get("/search", async (request, response) => {
  const query = z.string().trim().max(120).catch("").parse(request.query.q);
  if (!query) return response.json([]);
  const diagrams = await prisma.diagram.findMany({ where: { AND: [{ project: { workspace: { organization: { memberships: { some: { userId: authUser(request) } } } } } }, { OR: [{ title: { contains: query } }, { description: { contains: query } }, { tagsJson: { contains: query } }, { dsl: { contains: query } }] }] }, take: 40, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, description: true, type: true, revision: true, updatedAt: true, project: { select: { id: true, name: true } } } });
  response.json(diagrams);
});

api.get("/diagrams/:diagramId/export", async (request, response) => {
  await ensureDiagramAccess(request.params.diagramId!, authUser(request));
  const diagram = await prisma.diagram.findUniqueOrThrow({ where: { id: request.params.diagramId! } });
  const format = z.enum(["dsl", "json", "markdown"]).catch("dsl").parse(request.query.format);
  const slug = diagram.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (format === "json") { response.attachment(`${slug}.json`).type("application/json").send(JSON.stringify(decodeDiagram(diagram), null, 2)); return; }
  if (format === "markdown") { response.attachment(`${slug}.md`).type("text/markdown").send(`# ${diagram.title}\n\n${diagram.description}\n\n\`\`\`framelabs\n${diagram.dsl}\n\`\`\`\n`); return; }
  response.attachment(`${slug}.dsl`).type("text/plain").send(diagram.dsl);
});

api.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return response.status(400).json({ error: "Validation failed", details: error.issues });
  if (error instanceof ConflictError) return response.status(409).json({ error: error.message, current: decodeDiagram(error.current) });
  if (error instanceof AccessError) return response.status(error.message.includes("not found") ? 404 : 403).json({ error: error.message });
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
});
