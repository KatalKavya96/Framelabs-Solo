import { z } from "zod";

export const diagramType = z.enum(["ARCHITECTURE", "DATABASE", "SEQUENCE", "CLASS", "FLOW"]);
export const saveDiagramSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  type: diagramType.optional(),
  dsl: z.string().min(1).max(5_000_000),
  model: z.unknown(),
  tags: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  baseRevision: z.number().int().positive().optional(),
  summary: z.string().trim().min(1).max(240).optional(),
});
export const createDiagramSchema = saveDiagramSchema.extend({ projectId: z.string().min(1), title: z.string().trim().min(1).max(160), type: diagramType });
export const shareSchema = z.object({ permission: z.enum(["VIEW", "EDIT"]).default("VIEW"), scope: z.enum(["PUBLIC", "TEAM"]).default("PUBLIC"), expiresAt: z.string().datetime().nullable().optional() });
export const commentSchema = z.object({ body: z.string().trim().min(1).max(4000), nodeId: z.string().max(200).nullable().optional(), x: z.number().finite().nullable().optional(), y: z.number().finite().nullable().optional() });
