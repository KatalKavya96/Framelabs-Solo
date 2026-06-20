import type { Edge, Node } from "@xyflow/react";

export type NodeTone = "blue" | "purple" | "teal" | "amber";

export type ArchitectureData = {
  [key: string]: unknown;
  alias: string;
  label: string;
  subtitle: string;
  kind: string;
  technology: string;
  description: string;
  tone: NodeTone;
  group: string;
  status: string;
  environment: string;
  owner: string;
  tags: string[];
  shape: string;
  visible: boolean;
};

export type GroupData = {
  [key: string]: unknown;
  label: string;
  tone: NodeTone;
  width: number;
  height: number;
  visible: boolean;
};

export type DiagramNode = Node<ArchitectureData | GroupData>;

export type DiagramModel = {
  title: string;
  description: string;
  nodes: DiagramNode[];
  edges: Edge[];
};

const toneColor: Record<NodeTone, string> = {
  blue: "#2986ff",
  purple: "#a15cff",
  teal: "#02c7a5",
  amber: "#f0a500",
};

export const initialDsl = `diagram SystemArchitecture {
  title: "E-Commerce Platform Architecture"
  description: "High level system architecture"
}

group "Client Layer" at (245, 34) size (410, 100) color blue {
  web [Web Application] { type: app; tech: "React + TypeScript"; pos: (360, 58) }
}

group "Edge & API" at (245, 178) size (410, 100) color purple {
  gateway [API Gateway] { type: gateway; tech: "Kong"; pos: (360, 201) }
}

group "Services" at (110, 316) size (680, 112) color teal {
  auth [Auth Service] { type: service; tech: "Node.js"; pos: (128, 343) }
  user [User Service] { type: service; tech: "Node.js"; pos: (361, 343) }
  order [Order Service] { type: service; tech: "Node.js"; pos: (594, 343) }
}

group "Data Layer" at (96, 486) size (710, 112) color amber {
  db [PostgreSQL] { type: database; tech: "Primary Database"; pos: (128, 514) }
  cache [Redis Cache] { type: cache; tech: "Session Store"; pos: (361, 514) }
  storage [S3 Storage] { type: storage; tech: "File Storage"; pos: (594, 514) }
}

group "External Services" at (176, 655) size (550, 104) color blue {
  email [SendGrid] { type: external; tech: "Email Service"; pos: (232, 682) }
  payments [Stripe] { type: external; tech: "Payment Gateway"; pos: (493, 682) }
}

connections {
  web -> gateway
  gateway -> auth
  gateway -> user
  gateway -> order
  auth ~> db
  user ~> db
  user ~> cache
  order ~> cache
  order ~> storage
  db ~> email
  storage ~> email
  storage ~> payments
}`;

function quoted(source: string, name: string, fallback = "") {
  return source.match(new RegExp(`${name}:\\s*"([^"]*)"`))?.[1] ?? fallback;
}

export function parseDsl(source: string): DiagramModel {
  const nodes: DiagramNode[] = [];
  const edges: Edge[] = [];
  const aliases = new Set<string>();
  let group = "";
  let inConnections = false;
  let edgeIndex = 0;
  let title = "Untitled Diagram";
  let description = "";

  for (const originalLine of source.split("\n")) {
    const line = originalLine.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("title:")) title = quoted(line, "title", title);
    if (line.startsWith("description:")) description = quoted(line, "description");

    const groupMatch = line.match(/^group\s+"([^"]+)"\s+at\s+\((-?[\d.]+),\s*(-?[\d.]+)\)\s+size\s+\(([\d.]+),\s*([\d.]+)\)\s+color\s+(blue|purple|teal|amber)(?:\s+visible\s+(true|false))?\s*\{$/);
    if (groupMatch) {
      const [, label, x, y, width, height, tone, visibleValue] = groupMatch;
      const visible = visibleValue !== "false";
      group = label;
      nodes.push({
        id: `group-${label.toLowerCase().replace(/\W+/g, "-")}`,
        type: "architectureGroup",
        position: { x: Number(x), y: Number(y) },
        data: { label, tone: tone as NodeTone, width: Number(width), height: Number(height), visible },
        style: { width: Number(width), height: Number(height), zIndex: -1 },
        draggable: false,
        selectable: false,
        hidden: !visible,
      });
      continue;
    }

    if (line === "connections {") { inConnections = true; group = ""; continue; }
    if (line === "}") { if (inConnections) inConnections = false; else group = ""; continue; }

    if (inConnections) {
      const edgeMatch = line.match(/^(\w+)\s*(->|~>)\s*(\w+)(?:\s*:\s*"([^"]+)")?$/);
      if (!edgeMatch) continue;
      const [, sourceId, connector, targetId, label] = edgeMatch;
      edges.push({
        id: `edge-${sourceId}-${targetId}-${edgeIndex++}`,
        source: sourceId,
        target: targetId,
        label,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#9fb4c5", strokeWidth: 1.25, strokeDasharray: connector === "~>" ? "5 4" : undefined },
        markerEnd: { type: "arrowclosed" as const, color: "#9fb4c5", width: 14, height: 14 },
      });
      continue;
    }

    const nodeMatch = line.match(/^(\w+)\s+\[([^\]]+)\]\s*\{([^}]*)\}$/);
    if (!nodeMatch) continue;
    const [, alias, label, body] = nodeMatch;
    if (aliases.has(alias)) throw new Error(`Duplicate component alias: ${alias}`);
    aliases.add(alias);
    const pos = body.match(/pos:\s*\((-?[\d.]+),\s*(-?[\d.]+)\)/);
    const tone = (body.match(/color:\s*(blue|purple|teal|amber)/)?.[1] ?? groupTone(group)) as NodeTone;
    const visible = body.match(/visible:\s*(true|false)/)?.[1] !== "false";
    nodes.push({
      id: alias,
      type: "architecture",
      position: { x: Number(pos?.[1] ?? 100), y: Number(pos?.[2] ?? 100) },
      data: {
        alias,
        label,
        kind: body.match(/type:\s*(\w+)/)?.[1] ?? "service",
        technology: quoted(body, "tech", "Node.js"),
        subtitle: quoted(body, "tech", "Node.js"),
        description: quoted(body, "desc", "Handles system responsibilities"),
        tone,
        group,
        status: quoted(body, "status", "Active"),
        environment: quoted(body, "environment", "Production"),
        owner: quoted(body, "owner", "Platform Team"),
        tags: quoted(body, "tags", "").split(",").map(value => value.trim()).filter(Boolean),
        shape: quoted(body, "shape", "Rounded Rectangle"),
        visible,
      },
      style: { zIndex: 2 },
      hidden: !visible,
    });
  }

  const componentIds = new Set(nodes.filter(node => node.type === "architecture").map(node => node.id));
  for (const edge of edges) {
    if (!componentIds.has(edge.source) || !componentIds.has(edge.target)) throw new Error(`Unknown component in connection: ${edge.source} -> ${edge.target}`);
  }
  if (!componentIds.size) throw new Error("No architecture components found");
  return { title, description, nodes, edges };
}

function groupTone(group: string): NodeTone {
  if (group.includes("Edge")) return "purple";
  if (group.includes("Service") && !group.includes("External")) return "teal";
  if (group.includes("Data")) return "amber";
  return "blue";
}

export function serializeDsl(model: DiagramModel): string {
  const groups = model.nodes.filter(node => node.type === "architectureGroup") as Node<GroupData>[];
  const components = model.nodes.filter(node => node.type === "architecture") as Node<ArchitectureData>[];
  const lines = [`diagram SystemArchitecture {`, `  title: "${model.title}"`, `  description: "${model.description}"`, `}`];
  for (const groupNode of groups) {
    const data = groupNode.data;
    lines.push("", `group "${data.label}" at (${Math.round(groupNode.position.x)}, ${Math.round(groupNode.position.y)}) size (${data.width}, ${data.height}) color ${data.tone} visible ${data.visible !== false} {`);
    for (const node of components.filter(item => item.data.group === data.label)) {
      const d = node.data;
      lines.push(`  ${d.alias} [${d.label}] { type: ${d.kind}; tech: "${d.technology}"; desc: "${d.description}"; color: ${d.tone}; status: "${d.status}"; environment: "${d.environment}"; owner: "${d.owner}"; tags: "${d.tags.join(", ")}"; shape: "${d.shape}"; visible: ${d.visible !== false}; pos: (${Math.round(node.position.x)}, ${Math.round(node.position.y)}) }`);
    }
    lines.push("}");
  }
  lines.push("", "connections {");
  for (const edge of model.edges) lines.push(`  ${edge.source} ${edge.style?.strokeDasharray ? "~>" : "->"} ${edge.target}${edge.label ? ` : "${edge.label}"` : ""}`);
  lines.push("}");
  return lines.join("\n");
}

export const toneColorMap = toneColor;
