import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, Controls, MiniMap,
  ReactFlow, ReactFlowProvider, type Connection, type Edge, type EdgeChange, type NodeChange,
} from "@xyflow/react";
import type { Socket } from "socket.io-client";
import "@xyflow/react/dist/style.css";
import Icon from "../components/Icon";
import { ArchitectureGroup, ArchitectureNode } from "./ArchitectureNodes";
import { api, type ApiDiagram, type ApiUser, type Bootstrap, type DiagramComment, type DiagramSummary, type DiagramType, type DiagramVersion, type SearchResult, type ShareLink } from "./api";
import { createCollaborationSocket, emitSave, type Presence } from "./collaboration";
import { initialDsl, parseDsl, serializeDsl, toneColorMap, type ArchitectureData, type DiagramModel, type DiagramNode, type NodeTone } from "./dsl";
import { createDiagramDsl, workspacePalette } from "./templates";

const nodeTypes = { architecture: ArchitectureNode, architectureGroup: ArchitectureGroup };
const clientId = crypto.randomUUID();
const workspaceTabs: Array<[string, DiagramType]> = [["ERD","DATABASE"],["Flowchart","FLOW"],["UML","CLASS"],["Sequence","SEQUENCE"],["Arch","ARCHITECTURE"]];
const navIcons = [["home","Home"],["diamond","Diagram"],["database","Data"],["grid","Components"],["rocket","Deploy"],["code","Code"],["comment","Comments"],["layers","Layers"],["history","Version history"]];
type Snapshot = { code: string; model: DiagramModel };
type ConflictState = { remote: ApiDiagram; message: string };

function cloneModel(model: DiagramModel): DiagramModel {
  return { ...model, nodes: model.nodes.map(node => ({ ...node, position: { ...node.position }, data: { ...node.data } })), edges: model.edges.map(edge => ({ ...edge })) };
}

function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join("").slice(0,2).toUpperCase(); }
function downloadUrl(url:string,filename:string) { const link=document.createElement("a");link.href=url;link.download=filename;link.click(); }

function WorkspaceInner() {
  const fallback = useMemo(() => parseDsl(localStorage.getItem("framelabs-diagram") ?? initialDsl), []);
  const [model, setModel] = useState(fallback);
  const [code, setCode] = useState(() => serializeDsl(fallback));
  const [mode, setMode] = useState<"visual"|"code"|"split">("split");
  const [selectedId, setSelectedId] = useState("auth");
  const [parseError, setParseError] = useState("");
  const [saved, setSaved] = useState("Connecting...");
  const [toast, setToast] = useState("");
  const [activeTool, setActiveTool] = useState("select");
  const [diagramId, setDiagramId] = useState("");
  const [diagramType, setDiagramType] = useState<DiagramType>("ARCHITECTURE");
  const [revision, setRevision] = useState(1);
  const [user, setUser] = useState<ApiUser>({id:"demo-user",name:"Alex Morgan"});
  const [presence, setPresence] = useState<Presence[]>([]);
  const [connected, setConnected] = useState(false);
  const [ownSocketId, setOwnSocketId] = useState("");
  const [remoteCursors, setRemoteCursors] = useState<Record<string,Presence>>({});
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState<ConflictState|null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [previewVersion, setPreviewVersion] = useState<DiagramVersion|null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [collaborators,setCollaborators]=useState<Array<{id:string;permission:"VIEW"|"EDIT";user:ApiUser}>>([]);
  const [shareScope, setShareScope] = useState<"PUBLIC"|"TEAM">("PUBLIC");
  const [sharePermission, setSharePermission] = useState<"VIEW"|"EDIT">("VIEW");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<DiagramComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [workspaceContext,setWorkspaceContext]=useState({organization:"Workspace",workspace:"Engineering",project:"Project",projectId:""});
  const [projectDiagrams,setProjectDiagrams]=useState<DiagramSummary[]>([]);
  const [diagramMenuOpen,setDiagramMenuOpen]=useState(false);
  const [createOpen,setCreateOpen]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [searchResults,setSearchResults]=useState<SearchResult[]>([]);
  const [componentSearch,setComponentSearch]=useState("");
  const [layersOpen,setLayersOpen]=useState(false);
  const [minimapVisible,setMinimapVisible]=useState(true);
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [tags,setTags]=useState<string[]>([]);
  const history = useRef<Snapshot[]>([{ code: serializeDsl(fallback), model: cloneModel(fallback) }]);
  const historyIndex = useRef(0);
  const saveTimer = useRef<number|null>(null);
  const socketRef = useRef<Socket|null>(null);
  const modelRef = useRef(model);
  const codeRef = useRef(code);
  const diagramIdRef = useRef(diagramId);
  const revisionRef = useRef(revision);
  const diagramTypeRef = useRef(diagramType);
  const readOnlyRef = useRef(readOnly);
  const dirtyRef = useRef(false);
  const previewRef = useRef(false);
  const tagsRef=useRef(tags);
  const canvasRef = useRef<HTMLElement|null>(null);

  const notify = (message:string) => { setToast(message);window.setTimeout(()=>setToast(""),1900); };
  const setModelState = (next:DiagramModel) => { modelRef.current=next;setModel(next); };
  const setCodeState = (next:string) => { codeRef.current=next;setCode(next); };

  const applyServerDiagram = useCallback((diagram:ApiDiagram) => {
    const parsed=parseDsl(diagram.dsl);
    modelRef.current=parsed;codeRef.current=diagram.dsl;revisionRef.current=diagram.revision;diagramIdRef.current=diagram.id;diagramTypeRef.current=diagram.type;
    setModel(parsed);setCode(diagram.dsl);setRevision(diagram.revision);setDiagramId(diagram.id);setDiagramType(diagram.type);setTags(diagram.tags??[]);tagsRef.current=diagram.tags??[];setParseError("");setConflict(null);dirtyRef.current=false;setSaved("Saved just now");
    setProjectDiagrams(current=>current.map(item=>item.id===diagram.id?{...item,title:diagram.title,type:diagram.type,revision:diagram.revision,updatedAt:diagram.updatedAt}:item));
    history.current=[{code:diagram.dsl,model:cloneModel(parsed)}];historyIndex.current=0;
  },[]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const shareToken=new URLSearchParams(window.location.search).get("share");
        if(shareToken){const shared=await api.shared(shareToken);if(!active)return;setReadOnly(shared.permission==="VIEW");readOnlyRef.current=shared.permission==="VIEW";applyServerDiagram(shared.diagram);}
        else {const bootstrap=await api.bootstrap();if(!active)return;setUser(bootstrap.user);const context=findWorkspaceContext(bootstrap);setWorkspaceContext(context);setProjectDiagrams(context.diagrams);const requested=new URLSearchParams(window.location.search).get("diagram");const requestedDiagram=requested?await api.diagram(requested).catch(()=>null):null;if(requestedDiagram)applyServerDiagram(requestedDiagram);else if(bootstrap.diagram)applyServerDiagram(bootstrap.diagram);else setSaved("No diagram selected");}
      } catch(error){setSaved("Working offline");notify(error instanceof Error?error.message:"Backend unavailable");}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[applyServerDiagram]);

  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setSearchOpen(true);}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);

  const loadVersions = useCallback(async()=>{if(!diagramIdRef.current)return;try{setVersions(await api.versions(diagramIdRef.current));}catch(error){notify(error instanceof Error?error.message:"Could not load versions");}},[]);
  const loadComments = useCallback(async()=>{if(!diagramIdRef.current)return;try{setComments(await api.comments(diagramIdRef.current));}catch(error){notify(error instanceof Error?error.message:"Could not load comments");}},[]);

  useEffect(()=>{if(diagramId)void loadComments();},[diagramId,loadComments]);

  useEffect(()=>{
    if(!diagramId)return;
    const socket=createCollaborationSocket();socketRef.current=socket;
    const join=()=>{setConnected(true);setOwnSocketId(socket.id??"");socket.emit("join:diagram",{diagramId,name:user.name,color:"#05d1b1"});};
    socket.on("connect",join);
    socket.on("presence:updated",(items:Presence[])=>setPresence(items));
    socket.on("cursor:updated",(item:Presence)=>setRemoteCursors(current=>({...current,[item.socketId]:item})));
    socket.on("diagram:updated",({diagram,clientId:origin}:{diagram:ApiDiagram;clientId:string})=>{
      if(origin===clientId)return;
      if(previewRef.current){notify("A newer collaborative revision is available");return;}
      if(dirtyRef.current)setConflict({remote:diagram,message:"A collaborator saved while you have local changes."});
      else {applyServerDiagram(diagram);notify("Updated by a collaborator");}
    });
    socket.on("version:created",()=>{if(historyOpen)void loadVersions();});
    socket.on("comment:created",(comment:DiagramComment)=>setComments(current=>current.some(item=>item.id===comment.id)?current:[...current,comment]));
    socket.on("disconnect",()=>{setConnected(false);setPresence([]);});
    return()=>{socket.disconnect();socketRef.current=null;};
  },[diagramId,user.name,applyServerDiagram,historyOpen,loadVersions]);

  const flushSave = useCallback(async(next:DiagramModel,summary="Diagram updated",dsl=serializeDsl(next))=>{
    const id=diagramIdRef.current;if(!id||readOnlyRef.current)return;
    setSaved("Saving...");dirtyRef.current=true;
    const payload={diagramId:id,clientId,operationId:crypto.randomUUID(),title:next.title,description:next.description,type:diagramTypeRef.current,dsl,model:next,tags:tagsRef.current,baseRevision:revisionRef.current,summary};
    try{
      const socket=socketRef.current;
      if(socket?.connected){
        const result=await emitSave(socket,payload);
        if(!result.ok){if(result.current)setConflict({remote:result.current,message:result.error??"Revision conflict"});throw new Error(result.error??"Save failed");}
        if(result.revision){revisionRef.current=result.revision;setRevision(result.revision);}
      }else{
        const result=await api.save(id,payload);revisionRef.current=result.diagram.revision;setRevision(result.diagram.revision);
      }
      localStorage.setItem("framelabs-diagram",dsl);dirtyRef.current=false;setSaved("Saved just now");
      if(historyOpen)void loadVersions();
    }catch(error){setSaved("Save needs attention");if(!(error instanceof Error&&error.message.includes("changed")))notify(error instanceof Error?error.message:"Save failed");}
  },[historyOpen,loadVersions]);

  const scheduleSave = useCallback((next:DiagramModel,summary:string,dsl?:string)=>{
    if(readOnlyRef.current)return;dirtyRef.current=true;setSaved("Unsaved changes");
    if(saveTimer.current)window.clearTimeout(saveTimer.current);
    saveTimer.current=window.setTimeout(()=>void flushSave(next,summary,dsl),850);
  },[flushSave]);

  const commit = useCallback((next:DiagramModel,record=true,summary="Diagram updated")=>{
    const nextCode=serializeDsl(next);setModelState(next);setCodeState(nextCode);setParseError("");
    if(record){history.current=history.current.slice(0,historyIndex.current+1);history.current.push({code:nextCode,model:cloneModel(next)});if(history.current.length>60)history.current.shift();historyIndex.current=history.current.length-1;}
    scheduleSave(next,summary,nextCode);
  },[scheduleSave]);

  const onCodeChange=(value:string)=>{if(readOnly)return;setCodeState(value);try{const next=parseDsl(value);setModelState(next);setParseError("");scheduleSave(next,"DSL edited",value);}catch(error){setParseError(error instanceof Error?error.message:"Invalid DSL");setSaved("Fix DSL errors to save");}};
  const manualSave=()=>{if(saveTimer.current)window.clearTimeout(saveTimer.current);if(!parseError)void flushSave(modelRef.current,"Manual save",codeRef.current);};
  const onNodesChange=(changes:NodeChange<DiagramNode>[])=>{if(readOnly)return;const next={...modelRef.current,nodes:applyNodeChanges(changes,modelRef.current.nodes)};setModelState(next);if(changes.some(change=>change.type==="remove"))commit(next,true,"Component removed");};
  const onEdgesChange=(changes:EdgeChange[])=>{if(readOnly)return;const next={...modelRef.current,edges:applyEdgeChanges(changes,modelRef.current.edges)};setModelState(next);if(changes.some(change=>change.type==="remove"))commit(next,true,"Connection removed");};
  const onConnect=(connection:Connection)=>{if(readOnly)return;const edge:Edge={...connection,id:`edge-${connection.source}-${connection.target}-${Date.now()}`,type:"smoothstep",style:{stroke:"#9fb4c5",strokeWidth:1.25},markerEnd:{type:"arrowclosed" as const,color:"#9fb4c5"}};commit({...modelRef.current,edges:addEdge(edge,modelRef.current.edges)},true,"Connection created");};
  const onNodeDragStop=()=>{if(!readOnly)commit(modelRef.current,true,"Component moved");};

  const selected=model.nodes.find(node=>node.id===selectedId&&node.type==="architecture") as DiagramNode|undefined;
  const selectedData=selected?.data as ArchitectureData|undefined;
  const updateSelected=(patch:Partial<ArchitectureData>)=>{if(readOnly)return;const next={...modelRef.current,nodes:modelRef.current.nodes.map(node=>node.id===selectedId?{...node,data:{...node.data,...patch}}:node)};commit(next,true,"Component properties changed");};
  const applyLocalSnapshot=(index:number)=>{const snap=history.current[index];if(!snap)return;const direction=index<historyIndex.current?"Undo":"Redo";historyIndex.current=index;setModelState(cloneModel(snap.model));setCodeState(snap.code);scheduleSave(snap.model,direction,snap.code);};
  const undo=()=>{if(historyIndex.current>0)applyLocalSnapshot(historyIndex.current-1);};
  const redo=()=>{if(historyIndex.current<history.current.length-1)applyLocalSnapshot(historyIndex.current+1);};

  const addComponent=(label="New Service",kind="service")=>{if(readOnly)return;const count=modelRef.current.nodes.filter(node=>node.type==="architecture").length+1;const alias=`${kind.replace(/\W/g,"")||"node"}${count}`;const group=((modelRef.current.nodes.find(node=>node.type==="architectureGroup")?.data as {label?:string}|undefined)?.label)||"Components";const node:DiagramNode={id:alias,type:"architecture",position:{x:360,y:360},data:{alias,label,subtitle:kind,kind,technology:kind,description:`${label} component`,tone:"teal",group,status:"Active",environment:"Production",owner:user.name,tags:[diagramType.toLowerCase()],shape:"Rounded Rectangle",visible:true},style:{zIndex:2}};commit({...modelRef.current,nodes:[...modelRef.current.nodes,node]},true,`${label} added`);setSelectedId(node.id);notify(`${label} added`);};
  const changeDiagramType=(type:DiagramType)=>{if(readOnly)return;diagramTypeRef.current=type;setDiagramType(type);scheduleSave(modelRef.current,`Workspace changed to ${type}`,codeRef.current);notify(`${type.toLowerCase()} workspace active`);};

  const openHistory=async()=>{setHistoryOpen(true);setCommentsOpen(false);await loadVersions();};
  const preview=async(version:DiagramVersion)=>{if(!diagramId)return;const detail=await api.version(diagramId,version.id);previewRef.current=true;setPreviewVersion(detail);setModelState(parseDsl(detail.dsl));setCodeState(detail.dsl);};
  const exitPreview=async()=>{if(!diagramId)return;previewRef.current=false;applyServerDiagram(await api.diagram(diagramId));setPreviewVersion(null);};
  const restore=async(versionId:string)=>{if(!diagramId||readOnly)return;const result=await api.restore(diagramId,versionId);previewRef.current=false;applyServerDiagram(result.diagram);setPreviewVersion(null);await loadVersions();notify(`Restored as version ${result.diagram.lastVersionNumber}`);};

  const openShare=async()=>{if(!diagramId)return;setShareOpen(true);try{const [links,members]=await Promise.all([api.shares(diagramId),api.collaborators(diagramId)]);setShareLinks(links);setCollaborators(members);}catch{setShareLinks([]);setCollaborators([]);}};
  const createShare=async()=>{if(!diagramId)return;const link=await api.createShare(diagramId,{scope:shareScope,permission:sharePermission});setShareLinks(current=>[link,...current]);await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?share=${link.token}`);notify("Share link created and copied");};
  const copyShare=async(link:ShareLink)=>{await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?share=${link.token}`);notify("Share link copied");};
  const inviteCollaborator=async(email:string,permission:"VIEW"|"EDIT")=>{if(!diagramId)return;const collaborator=await api.addCollaborator(diagramId,email,permission);setCollaborators(current=>[...current.filter(item=>item.id!==collaborator.id),collaborator]);notify(`${collaborator.user.name} added`);};

  const openComments=async()=>{setCommentsOpen(true);setHistoryOpen(false);await loadComments();};
  const addComment=async()=>{if(!diagramId||!commentDraft.trim())return;const comment=await api.addComment(diagramId,{body:commentDraft,nodeId:selectedId||null});setComments(current=>current.some(item=>item.id===comment.id)?current:[...current,comment]);setCommentDraft("");};
  const resolveComment=async(comment:DiagramComment)=>{if(!diagramId)return;await api.resolveComment(diagramId,comment.id,!comment.resolved);setComments(current=>current.map(item=>item.id===comment.id?{...item,resolved:!item.resolved}:item));};

  const exportCanvas=async(format:"png"|"svg"|"pdf")=>{const target=canvasRef.current?.querySelector(".react-flow__viewport") as HTMLElement|null;if(!target)return;setExportOpen(false);setSaved("Preparing export...");try{const {toPng,toSvg}=await import("html-to-image");if(format==="svg"){const url=await toSvg(target,{backgroundColor:"#061521"});downloadUrl(url,"framelabs-diagram.svg");}else{const url=await toPng(target,{backgroundColor:"#061521",pixelRatio:2});if(format==="png")downloadUrl(url,"framelabs-diagram.png");else{const {jsPDF}=await import("jspdf");const pdf=new jsPDF({orientation:"landscape",unit:"px",format:[target.clientWidth,target.clientHeight]});pdf.addImage(url,"PNG",0,0,target.clientWidth,target.clientHeight);pdf.save("framelabs-diagram.pdf");}}notify(`${format.toUpperCase()} exported`);}catch{notify("Export failed");}finally{setSaved("Saved just now");}};
  const serverExport=(format:"dsl"|"json"|"markdown")=>{if(!diagramId)return;window.open(api.exportUrl(diagramId,format),"_blank","noopener");setExportOpen(false);};
  const acceptRemote=()=>{if(conflict)applyServerDiagram(conflict.remote);};
  const keepLocal=()=>{if(!conflict)return;revisionRef.current=conflict.remote.revision;setRevision(conflict.remote.revision);setConflict(null);void flushSave(modelRef.current,"Conflict resolved with local version",codeRef.current);};

  const switchDiagram=async(id:string)=>{if(id===diagramId)return;setLoading(true);try{const diagram=await api.diagram(id);applyServerDiagram(diagram);setSelectedId("");setDiagramMenuOpen(false);window.history.replaceState({},"",`${window.location.pathname}?diagram=${id}`);}finally{setLoading(false);}};
  const createNewDiagram=async(title:string,type:DiagramType)=>{if(!workspaceContext.projectId)return;const dsl=createDiagramDsl(type,title);const parsed=parseDsl(dsl);const result=await api.createDiagram({projectId:workspaceContext.projectId,title,description:parsed.description,type,dsl,model:parsed,tags:[type.toLowerCase()]});setProjectDiagrams(current=>[{id:result.diagram.id,title:result.diagram.title,type:result.diagram.type,revision:result.diagram.revision,updatedAt:result.diagram.updatedAt},...current]);setCreateOpen(false);applyServerDiagram(result.diagram);window.history.replaceState({},"",`${window.location.pathname}?diagram=${result.diagram.id}`);notify(`${title} created`);};
  const runSearch=async(query:string)=>{setSearchResults(query.trim()?await api.search(query.trim()):[]);};
  const toggleLayer=(group:string)=>{const members=modelRef.current.nodes.filter(node=>node.type==="architecture"&&(node.data as ArchitectureData).group===group);const nextVisible=members.every(node=>node.hidden);const next={...modelRef.current,nodes:modelRef.current.nodes.map(node=>{const data=node.data as ArchitectureData|{label?:string;visible?:boolean};const matches=(node.type==="architecture"&&(data as ArchitectureData).group===group)||(node.type==="architectureGroup"&&data.label===group);return matches?{...node,hidden:!nextVisible,data:{...node.data,visible:nextVisible}}:node;})};commit(next,true,`${nextVisible?"Shown":"Hidden"} layer ${group}`);};
  const generateDiagram=()=>{try{const parsed=parseDsl(codeRef.current);commit(parsed,true,"Generated from DSL");notify("Diagram regenerated from DSL");}catch(error){setParseError(error instanceof Error?error.message:"Invalid DSL");}};
  const saveDiagramSettings=(title:string,description:string,nextTags:string[])=>{tagsRef.current=nextTags;setTags(nextTags);commit({...modelRef.current,title,description},true,"Diagram settings changed");setSettingsOpen(false);};
  const handleRail=(label:string)=>{if(label==="Version history")void openHistory();else if(label==="Comments")void openComments();else if(label==="Code")setMode("code");else if(label==="Diagram")setMode("visual");else if(label==="Data")changeDiagramType("DATABASE");else if(label==="Components")document.querySelector<HTMLInputElement>(".component-search input")?.focus();else if(label==="Layers")setLayersOpen(value=>!value);else if(label==="Deploy")setExportOpen(true);else if(label==="Home")setDiagramMenuOpen(true);};

  const navigatorNodes=model.nodes.filter(node=>node.type==="architecture") as Array<DiagramNode & {data:ArchitectureData}>;
  const currentPalette=workspacePalette[diagramType].filter(([name])=>name.toLowerCase().includes(componentSearch.toLowerCase()));
  const layerNames=[...new Set(navigatorNodes.map(node=>node.data.group))];

  return <div className="workspace-shell">
    <header className="workspace-topbar">
      <a className="workspace-brand" href="/"><span className="brand-mark"><i/><i/><i/></span><strong>Framelabs</strong></a><span className="top-divider"/>
      <div className="breadcrumbs"><Icon name="home"/><span>{workspaceContext.workspace}</span><b>/</b><Icon name="briefcase"/><span>{workspaceContext.project}</span><Icon name="chevron"/><b>/</b><Icon name="code"/><strong>{model.title}</strong><em>{readOnly?"View only":saved.startsWith("Saved")?"Saved":"Draft"}</em><button className="command-search" onClick={()=>setSearchOpen(true)}><Icon name="search"/> Search <kbd>⌘K</kbd></button></div>
      <div className="top-actions"><button aria-label="Undo" onClick={undo} disabled={readOnly}><Icon name="history"/></button><button aria-label="Redo" onClick={redo} disabled={readOnly}><Icon name="arrow"/></button><button className="save-status" onClick={manualSave} aria-label="Save diagram"><i/> {saved}</button><div className="collaborators">{presence.slice(0,3).map(item=><span key={item.socketId} title={item.name}>{initials(item.name)}</span>)}{presence.length>3&&<b>+{presence.length-3}</b>}</div><button className="comment-pill" onClick={()=>void openComments()}><Icon name="comment"/> {comments.filter(item=>!item.resolved).length}</button><button className="share-button" onClick={()=>void openShare()} disabled={readOnly}><Icon name="upload"/> Share</button><div className="export-wrap"><button aria-label="Export diagram" onClick={()=>setExportOpen(value=>!value)}><Icon name="download"/></button>{exportOpen&&<ExportMenu onCanvas={exportCanvas} onServer={serverExport}/>}</div><button className="generate-button" onClick={generateDiagram}>▷ Generate <Icon name="chevron"/></button></div>
    </header>

    <div className="workspace-body">
      <nav className="rail">{navIcons.map(([icon,label],index)=><button aria-label={label} className={index===1?"active":""} key={label} onClick={()=>handleRail(label)}><Icon name={icon}/></button>)}<button className="rail-settings" aria-label="Settings" onClick={()=>setSettingsOpen(true)}><Icon name="diamond"/></button></nav>
      <aside className="navigator-panel"><div className="panel-title">Navigator <button onClick={()=>setDiagramMenuOpen(value=>!value)}>＋</button></div><div className="diagram-switcher"><button className="tree-root" onClick={()=>setDiagramMenuOpen(value=>!value)}>⌄ ▣ {model.title}</button>{diagramMenuOpen&&<div className="diagram-menu"><strong>{workspaceContext.project}</strong>{projectDiagrams.map(diagram=><button className={diagram.id===diagramId?"active":""} key={diagram.id} onClick={()=>void switchDiagram(diagram.id)}><span>{diagram.title}</span><small>{diagram.type.toLowerCase()} · r{diagram.revision}</small></button>)}<button className="new-diagram-action" onClick={()=>setCreateOpen(true)}>＋ New diagram</button></div>}</div><div className="tree">{layerNames.map(group=><div key={group}><div className="tree-group">⌄ ▧ {group}</div>{navigatorNodes.filter(node=>node.data.group===group).map(node=><button key={node.id} className={selectedId===node.id?"selected":""} onClick={()=>setSelectedId(node.id)}>▣ {node.data.label}</button>)}</div>)}</div><div className="components-title"><span>{diagramType.toLowerCase()} components</span><button>«</button></div><label className="component-search"><Icon name="search"/><input placeholder="Search components" value={componentSearch} onChange={event=>setComponentSearch(event.target.value)}/></label><small className="palette-label">Available</small><div className="component-grid">{currentPalette.map(([name,glyph,kind])=><button key={name} onClick={()=>addComponent(name,kind)} disabled={readOnly}><b>{glyph}</b><span>{name}</span></button>)}</div><small className="palette-label">Connectors</small><div className="component-grid connectors">{[["Line","→"],["Arrow","⟶"],["Bidirectional","↔"],["Dashed","---"],["Curve","↪"],["Orthogonal","↳"],["Dependency","⌁"],["Aggregation","♢"]].map(([name,glyph])=><button key={name} onClick={()=>setActiveTool("edge")}><b>{glyph}</b><span>{name}</span></button>)}</div><button className="drag-hint" onClick={()=>addComponent()}><Icon name="diamond"/> Add component to canvas <Icon name="chevron"/></button></aside>

      <main className="editor-area"><div className="editor-toolbar"><div className="mode-tabs">{(["visual","code","split"] as const).map(value=><button key={value} className={mode===value?"active":""} onClick={()=>setMode(value)}><Icon name={value==="code"?"code":value==="split"?"grid":"diamond"}/>{value[0].toUpperCase()+value.slice(1)}</button>)}</div><div className="diagram-tabs">{workspaceTabs.map(([label,type])=><button key={type} className={diagramType===type?"active":""} onClick={()=>changeDiagramType(type)}>{label}</button>)}<button onClick={()=>setCreateOpen(true)}>＋</button></div><div className="view-toggles"><button className={layersOpen?"active":""} onClick={()=>setLayersOpen(value=>!value)}>Layers</button><button className={minimapVisible?"active":""} onClick={()=>setMinimapVisible(value=>!value)}>Minimap</button><button className={commentsOpen?"active":""} onClick={()=>void openComments()}>Comments</button></div></div>
        {previewVersion&&<div className="preview-banner">Previewing version {previewVersion.versionNumber}: {previewVersion.summary}<span><button onClick={()=>void exitPreview()}>Exit preview</button>{!readOnly&&<button onClick={()=>void restore(previewVersion.id)}>Restore this version</button>}</span></div>}
        {readOnly&&<div className="readonly-banner">Read-only shared diagram</div>}
        <div className={`editor-surface mode-${mode}`}>
          {mode!=="visual"&&<section className="code-pane"><div className="code-tab"><span>diagram.dsl</span><button>×</button></div><div className="code-editor"><div className="line-numbers">{code.split("\n").map((_,index)=><span key={index}>{index+1}</span>)}</div><textarea aria-label="Diagram DSL editor" value={code} onChange={event=>onCodeChange(event.target.value)} spellCheck={false} readOnly={readOnly||Boolean(previewVersion)}/></div><div className={`code-status ${parseError?"error":""}`}><span><i/> {parseError||"No errors"}</span><span>Rev {revision} | DSL⌄ ⚙</span></div></section>}
          {mode!=="code"&&<section className="canvas-pane" ref={canvasRef} onPointerMove={event=>{const rect=event.currentTarget.getBoundingClientRect();socketRef.current?.volatile.emit("cursor:update",{x:event.clientX-rect.left,y:event.clientY-rect.top});}}><ReactFlow nodes={model.nodes} edges={model.edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeDragStop={onNodeDragStop} onNodeClick={(_,node)=>node.type==="architecture"&&setSelectedId(node.id)} fitView minZoom={.35} maxZoom={1.8} nodesDraggable={!readOnly&&!previewVersion} nodesConnectable={!readOnly&&!previewVersion} elementsSelectable={!previewVersion} defaultEdgeOptions={{type:"smoothstep"}}><Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#24445c"/><Controls showInteractive={false}/>{minimapVisible&&<MiniMap nodeColor={node=>node.type==="architectureGroup"?"transparent":toneColorMap[((node.data as ArchitectureData).tone??"blue")]} maskColor="rgba(3,14,25,.78)"/>}</ReactFlow>{Object.values(remoteCursors).filter(item=>item.socketId!==ownSocketId&&item.cursor).map(item=><div className="remote-cursor" key={item.socketId} style={{left:item.cursor!.x,top:item.cursor!.y,color:item.color}}><span>➤</span><b>{item.name}</b></div>)}{layersOpen&&<div className="layers-popover"><header>Layers <button onClick={()=>setLayersOpen(false)}>×</button></header>{layerNames.map(group=><label key={group}><input type="checkbox" checked={navigatorNodes.some(node=>node.data.group===group&&!node.hidden)} onChange={()=>toggleLayer(group)}/><span>{group}</span><small>{navigatorNodes.filter(node=>node.data.group===group).length}</small></label>)}</div>}<div className="canvas-tools">{[["select","➤"],["pan","☝"],["node","⌗"],["edge","⌁"],["text","T"],["comment","▱"],["add","＋"]].map(([tool,glyph])=><button className={activeTool===tool?"active":""} onClick={()=>tool==="add"?addComponent():tool==="comment"?void openComments():setActiveTool(tool)} key={tool}>{glyph}</button>)}</div></section>}
        </div>
      </main>

      <aside className="properties-panel"><div className="properties-tabs"><button className="active">Properties</button><button onClick={()=>setSettingsOpen(true)}>Diagram</button><button>«</button></div>{selectedData?<><div className="selected-summary"><span className={`summary-icon tone-${selectedData.tone}`}>◇</span><div><strong>{selectedData.label}</strong><small>{selectedData.kind[0].toUpperCase()+selectedData.kind.slice(1)}</small></div><button onClick={()=>setSelectedId("")}>×</button></div><fieldset disabled={readOnly||Boolean(previewVersion)}><PropertyGroup title="Basic"><Field label="Name"><input value={selectedData.label} onChange={event=>updateSelected({label:event.target.value})}/></Field><Field label="Type"><select value={selectedData.kind} onChange={event=>updateSelected({kind:event.target.value})}>{["service","app","gateway","database","cache","storage","external","queue","container","note"].map(kind=><option key={kind}>{kind}</option>)}</select></Field><Field label="Technology"><input value={selectedData.technology} onChange={event=>updateSelected({technology:event.target.value,subtitle:event.target.value})}/></Field><Field label="Description"><textarea value={selectedData.description} onChange={event=>updateSelected({description:event.target.value})}/></Field></PropertyGroup><PropertyGroup title="Appearance"><Field label="Icon"><select value={selectedData.kind} onChange={event=>updateSelected({kind:event.target.value})}>{["service","app","gateway","database","cache","storage","external","queue","container","note"].map(kind=><option key={kind}>{kind}</option>)}</select></Field><Field label="Color"><select value={selectedData.tone} onChange={event=>updateSelected({tone:event.target.value as NodeTone})}><option value="teal">Teal</option><option value="blue">Blue</option><option value="purple">Purple</option><option value="amber">Amber</option></select></Field><Field label="Shape"><select value={selectedData.shape} onChange={event=>updateSelected({shape:event.target.value})}><option>Rounded Rectangle</option><option>Rectangle</option><option>Pill</option><option>Diamond</option></select></Field></PropertyGroup><PropertyGroup title="Connectors"><Field label="Incoming"><select><option>Auto</option><option>Top</option><option>Left</option></select></Field><Field label="Outgoing"><select><option>Auto</option><option>Bottom</option><option>Right</option></select></Field><Field label="Line Style"><select><option>────────</option><option>- - - - -</option></select></Field></PropertyGroup><PropertyGroup title="Metadata"><Field label="Environment"><input value={selectedData.environment} onChange={event=>updateSelected({environment:event.target.value})}/></Field><Field label="Owner"><input value={selectedData.owner} onChange={event=>updateSelected({owner:event.target.value})}/></Field><Field label="Tags"><input value={selectedData.tags.join(", ")} onChange={event=>updateSelected({tags:event.target.value.split(",").map(value=>value.trim()).filter(Boolean)})}/></Field><Field label="Status"><select value={selectedData.status} onChange={event=>updateSelected({status:event.target.value})}><option>Active</option><option>Draft</option><option>Deprecated</option><option>Planned</option></select></Field></PropertyGroup></fieldset><button className="collapsed-row" onClick={()=>void openHistory()}>Version documentation <span>{versions.length||revision} ›</span></button><button className="collapsed-row" onClick={()=>void openComments()}>Annotations <span>{comments.length} ›</span></button><div className="ai-card"><strong>✣ DSL Assistant</strong><p>Validate and regenerate the visual diagram from its current code definition.</p><button onClick={generateDiagram}>→</button></div></>:<div className="empty-properties">Select a component to edit its properties.</div>}</aside>
    </div>

    <footer className="workspace-status"><span><i/> {connected?"Live collaboration":"Connecting collaboration"}</span><span>♣ {presence.length||1} online</span><span>⟳ {saved.startsWith("Saved")?"Synced":"Pending"}</span><span className="status-right">◉ Auto-save on</span></footer>
    {historyOpen&&<HistoryDrawer versions={versions} currentRevision={revision} previewVersion={previewVersion} onClose={()=>setHistoryOpen(false)} onPreview={version=>void preview(version)} onRestore={version=>void restore(version.id)}/>} 
    {commentsOpen&&<CommentsDrawer comments={comments} draft={commentDraft} onDraft={setCommentDraft} onClose={()=>setCommentsOpen(false)} onAdd={()=>void addComment()} onResolve={comment=>void resolveComment(comment)}/>} 
    {shareOpen&&<ShareDialog links={shareLinks} collaborators={collaborators} scope={shareScope} permission={sharePermission} onScope={setShareScope} onPermission={setSharePermission} onInvite={(email,nextPermission)=>void inviteCollaborator(email,nextPermission)} onCreate={()=>void createShare()} onCopy={link=>void copyShare(link)} onDelete={async link=>{if(!diagramId)return;await api.deleteShare(diagramId,link.id);setShareLinks(current=>current.filter(item=>item.id!==link.id));}} onClose={()=>setShareOpen(false)}/>} 
    {createOpen&&<CreateDiagramDialog onClose={()=>setCreateOpen(false)} onCreate={(title,type)=>void createNewDiagram(title,type)}/>} 
    {searchOpen&&<SearchDialog results={searchResults} onSearch={query=>void runSearch(query)} onSelect={id=>{setSearchOpen(false);void switchDiagram(id);}} onClose={()=>{setSearchOpen(false);setSearchResults([]);}}/>}
    {settingsOpen&&<SettingsDialog title={model.title} description={model.description} tags={tags} type={diagramType} onClose={()=>setSettingsOpen(false)} onSave={saveDiagramSettings}/>} 
    {conflict&&<ConflictDialog message={conflict.message} remote={conflict.remote} onRemote={acceptRemote} onLocal={keepLocal}/>} 
    {loading&&<div className="workspace-loading"><span className="brand-mark"><i/><i/><i/></span> Loading engineering workspace…</div>}
    {toast&&<div className="workspace-toast" role="status">{toast}</div>}
  </div>;
}

function PropertyGroup({title,children}:{title:string;children:React.ReactNode}){return <section className="property-group"><h3>{title}<span>⌃</span></h3>{children}</section>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="property-field"><span>{label}</span>{children}</label>;}

function HistoryDrawer({versions,currentRevision,previewVersion,onClose,onPreview,onRestore}:{versions:DiagramVersion[];currentRevision:number;previewVersion:DiagramVersion|null;onClose:()=>void;onPreview:(version:DiagramVersion)=>void;onRestore:(version:DiagramVersion)=>void}){return <aside className="side-drawer history-drawer"><header><div><strong>Version history</strong><small>Revision {currentRevision}</small></div><button onClick={onClose}>×</button></header><div className="drawer-body">{versions.map(version=><article className={previewVersion?.id===version.id?"active":""} key={version.id}><span className="version-dot"/><div><strong>Version {version.versionNumber}</strong><p>{version.summary}</p><small>{version.actor.name} · {new Date(version.createdAt).toLocaleString()}</small><div><button onClick={()=>onPreview(version)}>Preview</button><button onClick={()=>onRestore(version)}>Restore</button></div></div></article>)}</div></aside>;}
function CommentsDrawer({comments,draft,onDraft,onClose,onAdd,onResolve}:{comments:DiagramComment[];draft:string;onDraft:(value:string)=>void;onClose:()=>void;onAdd:()=>void;onResolve:(comment:DiagramComment)=>void}){return <aside className="side-drawer comments-drawer"><header><div><strong>Comments</strong><small>{comments.filter(item=>!item.resolved).length} open threads</small></div><button onClick={onClose}>×</button></header><div className="drawer-body">{comments.map(comment=><article className={comment.resolved?"resolved":""} key={comment.id}><span className="comment-avatar">{initials(comment.author.name)}</span><div><strong>{comment.author.name}</strong><small>{new Date(comment.createdAt).toLocaleString()}</small><p>{comment.body}</p><button onClick={()=>onResolve(comment)}>{comment.resolved?"Reopen":"Resolve"}</button></div></article>)}</div><footer><textarea placeholder="Comment on the selected component…" value={draft} onChange={event=>onDraft(event.target.value)}/><button onClick={onAdd}>Comment</button></footer></aside>;}
function ShareDialog({links,collaborators,scope,permission,onScope,onPermission,onInvite,onCreate,onCopy,onDelete,onClose}:{links:ShareLink[];collaborators:Array<{id:string;permission:"VIEW"|"EDIT";user:ApiUser}>;scope:"PUBLIC"|"TEAM";permission:"VIEW"|"EDIT";onScope:(value:"PUBLIC"|"TEAM")=>void;onPermission:(value:"VIEW"|"EDIT")=>void;onInvite:(email:string,permission:"VIEW"|"EDIT")=>void;onCreate:()=>void;onCopy:(link:ShareLink)=>void;onDelete:(link:ShareLink)=>void;onClose:()=>void}){const[email,setEmail]=useState("");const[invitePermission,setInvitePermission]=useState<"VIEW"|"EDIT">("EDIT");return <div className="modal-scrim"><section className="share-dialog"><header><div><strong>Share diagram</strong><small>Manage people and permission-controlled links</small></div><button onClick={onClose}>×</button></header><div className="collaborator-invite"><input placeholder="Teammate email" value={email} onChange={event=>setEmail(event.target.value)}/><select value={invitePermission} onChange={event=>setInvitePermission(event.target.value as "VIEW"|"EDIT")}><option value="EDIT">Can edit</option><option value="VIEW">Can view</option></select><button disabled={!email.includes("@")} onClick={()=>{onInvite(email,invitePermission);setEmail("");}}>Invite</button></div><div className="collaborator-list">{collaborators.map(item=><span key={item.id}><b>{initials(item.user.name)}</b><em>{item.user.name}<small>{item.user.email}</small></em><i>{item.permission.toLowerCase()}</i></span>)}</div><div className="share-create"><label>Access<select value={scope} onChange={event=>onScope(event.target.value as "PUBLIC"|"TEAM")}><option value="PUBLIC">Anyone with the link</option><option value="TEAM">Workspace members only</option></select></label><label>Permission<select value={permission} onChange={event=>onPermission(event.target.value as "VIEW"|"EDIT")}><option value="VIEW">Can view</option><option value="EDIT">Can edit</option></select></label><button onClick={onCreate}>Create link</button></div><div className="share-links">{links.length===0?<p>No active links yet.</p>:links.map(link=><article key={link.id}><span><strong>{link.scope==="PUBLIC"?"Public link":"Team link"}</strong><small>{link.permission.toLowerCase()} access · {new Date(link.createdAt).toLocaleDateString()}</small></span><button onClick={()=>onCopy(link)}>Copy</button><button onClick={()=>onDelete(link)}>Revoke</button></article>)}</div></section></div>;}
function ConflictDialog({message,remote,onRemote,onLocal}:{message:string;remote:ApiDiagram;onRemote:()=>void;onLocal:()=>void}){return <div className="modal-scrim"><section className="conflict-dialog"><span>!</span><h2>Concurrent edit detected</h2><p>{message} The server is at revision {remote.revision}; your local work is still intact.</p><div><button onClick={onRemote}>Use collaborator version</button><button onClick={onLocal}>Keep my version</button></div></section></div>;}
function ExportMenu({onCanvas,onServer}:{onCanvas:(format:"png"|"svg"|"pdf")=>void;onServer:(format:"dsl"|"json"|"markdown")=>void}){return <div className="export-menu"><strong>Export diagram</strong><button onClick={()=>onCanvas("png")}>PNG image</button><button onClick={()=>onCanvas("svg")}>SVG vector</button><button onClick={()=>onCanvas("pdf")}>PDF document</button><hr/><button onClick={()=>onServer("dsl")}>Framelabs DSL</button><button onClick={()=>onServer("json")}>Diagram JSON</button><button onClick={()=>onServer("markdown")}>Markdown embed</button></div>;}

function CreateDiagramDialog({onClose,onCreate}:{onClose:()=>void;onCreate:(title:string,type:DiagramType)=>void}){const[title,setTitle]=useState("Untitled Diagram");const[type,setType]=useState<DiagramType>("ARCHITECTURE");return <div className="modal-scrim"><section className="form-dialog"><header><div><strong>Create diagram</strong><small>Choose a specialized engineering workspace</small></div><button onClick={onClose}>×</button></header><label>Name<input value={title} onChange={event=>setTitle(event.target.value)} autoFocus/></label><label>Workspace type<select value={type} onChange={event=>setType(event.target.value as DiagramType)}>{workspaceTabs.map(([label,value])=><option value={value} key={value}>{label}</option>)}</select></label><div className="template-types">{workspaceTabs.map(([label,value])=><button className={type===value?"active":""} onClick={()=>setType(value)} key={value}><b>{label}</b><small>{value.toLowerCase()} tools</small></button>)}</div><footer><button onClick={onClose}>Cancel</button><button disabled={!title.trim()} onClick={()=>onCreate(title.trim(),type)}>Create diagram</button></footer></section></div>;}
function SearchDialog({results,onSearch,onSelect,onClose}:{results:SearchResult[];onSearch:(query:string)=>void;onSelect:(id:string)=>void;onClose:()=>void}){const[query,setQuery]=useState("");return <div className="modal-scrim search-scrim"><section className="search-dialog"><header><Icon name="search"/><input aria-label="Search workspace" placeholder="Search diagrams, components, tags…" value={query} onChange={event=>{setQuery(event.target.value);onSearch(event.target.value);}} autoFocus/><kbd>esc</kbd><button onClick={onClose}>×</button></header><div>{query&&!results.length?<p>No matching engineering documents.</p>:results.map(result=><button key={result.id} onClick={()=>onSelect(result.id)}><Icon name="file"/><span><strong>{result.title}</strong><small>{result.project.name} · {result.type.toLowerCase()} · revision {result.revision}</small></span><b>↵</b></button>)}</div></section></div>;}
function SettingsDialog({title,description,tags,type,onClose,onSave}:{title:string;description:string;tags:string[];type:DiagramType;onClose:()=>void;onSave:(title:string,description:string,tags:string[])=>void}){const[nextTitle,setNextTitle]=useState(title);const[nextDescription,setNextDescription]=useState(description);const[tagText,setTagText]=useState(tags.join(", "));return <div className="modal-scrim"><section className="form-dialog"><header><div><strong>Diagram settings</strong><small>{type.toLowerCase()} document metadata</small></div><button onClick={onClose}>×</button></header><label>Title<input value={nextTitle} onChange={event=>setNextTitle(event.target.value)}/></label><label>Description<textarea value={nextDescription} onChange={event=>setNextDescription(event.target.value)}/></label><label>Search tags<input value={tagText} onChange={event=>setTagText(event.target.value)} placeholder="architecture, production"/></label><footer><button onClick={onClose}>Cancel</button><button onClick={()=>onSave(nextTitle,nextDescription,tagText.split(",").map(value=>value.trim()).filter(Boolean))}>Save settings</button></footer></section></div>;}

function findWorkspaceContext(bootstrap:Bootstrap){for(const organization of bootstrap.organizations)for(const workspace of organization.workspaces)for(const project of workspace.projects)if(project.diagrams.some(diagram=>diagram.id===bootstrap.diagram?.id)||!bootstrap.diagram)return{organization:organization.name,workspace:workspace.name,project:project.name,projectId:project.id,diagrams:project.diagrams};return{organization:"Workspace",workspace:"Engineering",project:"Project",projectId:"",diagrams:[] as DiagramSummary[]};}

export default function Workspace(){return <ReactFlowProvider><WorkspaceInner/></ReactFlowProvider>;}
