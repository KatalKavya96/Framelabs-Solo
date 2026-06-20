import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ArchitectureData, GroupData } from "./dsl";

const glyphs: Record<string, string> = { app: "▣", gateway: "⌁", service: "◇", database: "◉", cache: "▱", storage: "▤", external: "S" };

export function ArchitectureNode({ data, selected }: NodeProps<Node<ArchitectureData>>) {
  const shape = data.shape?.toLowerCase().replace(/\s+/g,"-") ?? "rounded-rectangle";
  return <div className={`arch-node tone-${data.tone} shape-${shape} ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Top} />
    <span className="arch-glyph">{glyphs[data.kind] ?? "◇"}</span>
    <span className="arch-copy"><strong>{data.label}</strong><small>{data.technology}</small></span>
    <Handle type="source" position={Position.Bottom} />
  </div>;
}

export function ArchitectureGroup({ data }: NodeProps<Node<GroupData>>) {
  return <div className={`arch-group tone-${data.tone}`} style={{ width: data.width, height: data.height }}><span>{data.label}</span></div>;
}
