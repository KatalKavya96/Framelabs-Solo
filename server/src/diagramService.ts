import type { Diagram, Prisma } from "@prisma/client";
import { prisma } from "./db.js";

export class ConflictError extends Error {
  constructor(public current: Diagram) { super("Diagram changed on another client"); }
}

export class AccessError extends Error {
  constructor(message = "Diagram access denied") { super(message); }
}

export type SaveDiagramInput = {
  title?: string;
  description?: string;
  type?: string;
  dsl: string;
  model: unknown;
  tags?: string[];
  baseRevision?: number;
  summary?: string;
};

export function decodeDiagram<T extends { modelJson: string; tagsJson: string }>(diagram: T) {
  return { ...diagram, model: JSON.parse(diagram.modelJson) as unknown, tags: JSON.parse(diagram.tagsJson) as string[], modelJson: undefined, tagsJson: undefined };
}

export async function ensureDiagramAccess(diagramId: string, userId: string, write = false) {
  const diagram = await prisma.diagram.findUnique({
    where: { id: diagramId },
    include: {
      collaborators: { where: { userId } },
      project: { include: { workspace: { include: { organization: { include: { memberships: { where: { userId } } } } } } } },
    },
  });
  if (!diagram) throw new AccessError("Diagram not found");
  const membership = diagram.project.workspace.organization.memberships[0];
  const collaborator = diagram.collaborators[0];
  const allowed = diagram.createdById === userId || Boolean(membership) || Boolean(collaborator && (!write || collaborator.permission === "EDIT"));
  if (!allowed) throw new AccessError();
  return diagram;
}

export async function saveDiagram(diagramId: string, userId: string, input: SaveDiagramInput) {
  await ensureDiagramAccess(diagramId, userId, true);
  return prisma.$transaction(async transaction => {
    const current = await transaction.diagram.findUniqueOrThrow({ where: { id: diagramId } });
    if (input.baseRevision !== undefined && input.baseRevision !== current.revision) throw new ConflictError(current);
    const title = input.title ?? current.title;
    const description = input.description ?? current.description;
    const modelJson = JSON.stringify(input.model ?? {});
    const tagsJson = JSON.stringify(input.tags ?? JSON.parse(current.tagsJson));
    const unchanged = current.dsl === input.dsl && current.modelJson === modelJson && current.title === title && current.description === description && current.type === (input.type ?? current.type) && current.tagsJson === tagsJson;
    if (unchanged) return { diagram: current, version: null, unchanged: true };

    const revision = current.revision + 1;
    const versionNumber = current.lastVersionNumber + 1;
    const updatedRows = await transaction.diagram.updateMany({
      where: { id: diagramId, revision: current.revision },
      data: { title, description, type: input.type ?? current.type, dsl: input.dsl, modelJson, tagsJson, revision, lastVersionNumber: versionNumber, updatedById: userId },
    });
    if (updatedRows.count !== 1) {
      const latest = await transaction.diagram.findUniqueOrThrow({ where: { id: diagramId } });
      throw new ConflictError(latest);
    }
    const version = await transaction.diagramVersion.create({
      data: { diagramId, versionNumber, revision, title, description, dsl: input.dsl, modelJson, summary: input.summary ?? "Diagram updated", actorId: userId },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const diagram = await transaction.diagram.findUniqueOrThrow({ where: { id: diagramId } });
    return { diagram, version, unchanged: false };
  }, { timeout: 10_000 });
}

export async function restoreVersion(diagramId: string, versionId: string, userId: string) {
  await ensureDiagramAccess(diagramId, userId, true);
  const version = await prisma.diagramVersion.findFirst({ where: { id: versionId, diagramId } });
  if (!version) throw new AccessError("Version not found");
  return saveDiagram(diagramId, userId, { title: version.title, description: version.description, dsl: version.dsl, model: JSON.parse(version.modelJson), summary: `Restored version ${version.versionNumber}` });
}

export async function createDiagram(input: { projectId: string; title: string; description?: string; type: string; dsl: string; model: unknown; tags?: string[] }, userId: string) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, workspace: { organization: { memberships: { some: { userId } } } } } });
  if (!project) throw new AccessError("Project access denied");
  return prisma.$transaction(async transaction => {
    const diagram = await transaction.diagram.create({ data: { projectId: input.projectId, title: input.title, description: input.description ?? "", type: input.type, dsl: input.dsl, modelJson: JSON.stringify(input.model), tagsJson: JSON.stringify(input.tags ?? []), createdById: userId, updatedById: userId } });
    const version = await transaction.diagramVersion.create({ data: { diagramId: diagram.id, versionNumber: 1, revision: 1, title: diagram.title, description: diagram.description, dsl: diagram.dsl, modelJson: diagram.modelJson, summary: "Diagram created", actorId: userId } });
    return { diagram, version };
  });
}

export type TransactionClient = Prisma.TransactionClient;
