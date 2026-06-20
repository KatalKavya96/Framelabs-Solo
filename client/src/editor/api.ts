export type DiagramType = "ARCHITECTURE" | "DATABASE" | "SEQUENCE" | "CLASS" | "FLOW";

export type ApiUser = { id: string; name: string; email?: string; avatarUrl?: string | null };
export type ApiDiagram = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: DiagramType;
  dsl: string;
  model: unknown;
  tags: string[];
  revision: number;
  lastVersionNumber: number;
  createdAt: string;
  updatedAt: string;
};
export type DiagramVersion = { id: string; versionNumber: number; revision: number; title: string; summary: string; createdAt: string; actor: ApiUser; dsl?: string; model?: unknown };
export type ShareLink = { id: string; token: string; permission: "VIEW"|"EDIT"; scope: "PUBLIC"|"TEAM"; expiresAt: string|null; createdAt: string };
export type DiagramComment = { id: string; body: string; nodeId?: string|null; resolved: boolean; createdAt: string; author: ApiUser };
export type DiagramSummary = {id:string;title:string;description?:string;type:DiagramType;revision:number;updatedAt?:string};
export type SearchResult = DiagramSummary & {project:{id:string;name:string}};
export type Bootstrap = { user: ApiUser; organizations: Array<{ id:string;name:string;role:string;workspaces:Array<{id:string;name:string;projects:Array<{id:string;name:string;diagrams:DiagramSummary[]}>}> }>; diagram: ApiDiagram|null };

const API = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type":"application/json", ...(init?.headers ?? {}) } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(body?.error ?? `Request failed (${response.status})`) as Error & { status?:number; data?:unknown };
    error.status=response.status; error.data=body; throw error;
  }
  return body as T;
}

export const api = {
  bootstrap: () => request<Bootstrap>("/bootstrap"),
  shared: (token:string) => request<{permission:"VIEW"|"EDIT";scope:string;diagram:ApiDiagram}>(`/shared/${encodeURIComponent(token)}`),
  diagram: (id:string) => request<ApiDiagram>(`/diagrams/${id}`),
  createDiagram: (input:{projectId:string;title:string;description:string;type:DiagramType;dsl:string;model:unknown;tags:string[]}) => request<{diagram:ApiDiagram}>("/diagrams",{method:"POST",body:JSON.stringify(input)}),
  projectDiagrams: (projectId:string) => request<ApiDiagram[]>(`/projects/${projectId}/diagrams`),
  search: (query:string) => request<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
  save: (id:string,input:{title:string;description:string;type:DiagramType;dsl:string;model:unknown;tags:string[];baseRevision:number;summary:string}) => request<{diagram:ApiDiagram;version:DiagramVersion|null;unchanged:boolean}>(`/diagrams/${id}`,{method:"PUT",body:JSON.stringify(input)}),
  versions: (id:string) => request<DiagramVersion[]>(`/diagrams/${id}/versions`),
  version: (diagramId:string,versionId:string) => request<DiagramVersion & {dsl:string;model:unknown;description:string}>(`/diagrams/${diagramId}/versions/${versionId}`),
  restore: (diagramId:string,versionId:string) => request<{diagram:ApiDiagram;version:DiagramVersion}>(`/diagrams/${diagramId}/versions/${versionId}/restore`,{method:"POST"}),
  shares: (id:string) => request<ShareLink[]>(`/diagrams/${id}/share-links`),
  createShare: (id:string,input:{permission:"VIEW"|"EDIT";scope:"PUBLIC"|"TEAM"}) => request<ShareLink>(`/diagrams/${id}/share-links`,{method:"POST",body:JSON.stringify(input)}),
  deleteShare: (diagramId:string,shareId:string) => request<void>(`/diagrams/${diagramId}/share-links/${shareId}`,{method:"DELETE"}),
  comments: (id:string) => request<DiagramComment[]>(`/diagrams/${id}/comments`),
  collaborators: (id:string) => request<Array<{id:string;permission:"VIEW"|"EDIT";user:ApiUser}>>(`/diagrams/${id}/collaborators`),
  addCollaborator: (id:string,email:string,permission:"VIEW"|"EDIT") => request<{id:string;permission:"VIEW"|"EDIT";user:ApiUser}>(`/diagrams/${id}/collaborators`,{method:"POST",body:JSON.stringify({email,permission})}),
  addComment: (id:string,input:{body:string;nodeId?:string|null}) => request<DiagramComment>(`/diagrams/${id}/comments`,{method:"POST",body:JSON.stringify(input)}),
  resolveComment: (diagramId:string,commentId:string,resolved:boolean) => request<{ok:boolean}>(`/diagrams/${diagramId}/comments/${commentId}`,{method:"PATCH",body:JSON.stringify({resolved})}),
  exportUrl: (id:string,format:"dsl"|"json"|"markdown") => `${API}/diagrams/${id}/export?format=${format}`,
};
