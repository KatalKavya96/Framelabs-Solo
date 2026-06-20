import { io, type Socket } from "socket.io-client";
import type { ApiDiagram } from "./api";

export type Presence = { socketId:string;userId:string;name:string;color:string;cursor?:{x:number;y:number} };
export type SaveSocketPayload = { diagramId:string;clientId:string;operationId:string;title:string;description:string;type:string;dsl:string;model:unknown;tags:string[];baseRevision:number;summary:string };
export type SaveAck = { ok:boolean;revision?:number;error?:string;current?:ApiDiagram };

export function createCollaborationSocket() {
  return io(import.meta.env.VITE_SOCKET_URL ?? "/", { path:"/socket.io", transports:["websocket","polling"], autoConnect:true, auth:{token:localStorage.getItem("framelabs-token")??""} });
}

export function emitSave(socket:Socket,payload:SaveSocketPayload) {
  return new Promise<SaveAck>(resolve => socket.timeout(7000).emit("diagram:change",payload,(error:Error|null,result:SaveAck)=>resolve(error?{ok:false,error:"Realtime save timed out"}:result)));
}
