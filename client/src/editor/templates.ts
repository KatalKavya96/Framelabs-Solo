import type { DiagramType } from "./api";
import { initialDsl } from "./dsl";

const definitions: Record<Exclude<DiagramType,"ARCHITECTURE">,{description:string;groups:Array<{name:string;color:string;y:number;nodes:Array<[string,string,string,string]>}>;connections:string[]}> = {
  DATABASE:{description:"Relational database schema",groups:[{name:"Domain Tables",color:"blue",y:80,nodes:[["users","Users","database","Primary entity"],["orders","Orders","database","Transactional entity"],["products","Products","database","Catalog entity"]]},{name:"Supporting Tables",color:"amber",y:290,nodes:[["sessions","Sessions","cache","Session records"],["payments","Payments","database","Payment records"]]}],connections:["users -> orders : \"1:N\"","products -> orders : \"N:M\"","users ~> sessions : \"1:N\"","orders -> payments : \"1:1\""]},
  SEQUENCE:{description:"Request and response sequence",groups:[{name:"Participants",color:"purple",y:100,nodes:[["actor","Customer","external","Actor"],["web","Web App","app","Client"],["api","API","gateway","Service"],["db","Database","database","Data store"]]}],connections:["actor -> web : \"Submit request\"","web -> api : \"POST /request\"","api -> db : \"Query\"","db ~> api : \"Result\""]},
  CLASS:{description:"Object-oriented class model",groups:[{name:"Domain Model",color:"teal",y:100,nodes:[["user","User","service","Class"],["order","Order","service","Class"],["product","Product","service","Class"],["repository","Repository","gateway","Interface"]]}],connections:["user -> order : \"association\"","order -> product : \"aggregation\"","repository ~> order : \"dependency\""]},
  FLOW:{description:"Process and decision flow",groups:[{name:"Process",color:"blue",y:100,nodes:[["start","Start","external","Trigger"],["validate","Validate Request","service","Process"],["decision","Approved?","gateway","Decision"],["complete","Complete","storage","End"]]}],connections:["start -> validate","validate -> decision","decision -> complete : \"yes\""]},
};

export function createDiagramDsl(type:DiagramType,title:string) {
  if(type==="ARCHITECTURE") return initialDsl.replace("E-Commerce Platform Architecture",title);
  const definition=definitions[type];
  const lines=[`diagram ${type} {`,`  title: "${title}"`,`  description: "${definition.description}"`,`}`];
  for(const group of definition.groups){
    const width=Math.max(500,group.nodes.length*190);lines.push("",`group "${group.name}" at (100, ${group.y}) size (${width}, 130) color ${group.color} visible true {`);
    group.nodes.forEach(([alias,label,kind,tech],index)=>lines.push(`  ${alias} [${label}] { type: ${kind}; tech: "${tech}"; desc: "${label} component"; color: ${group.color}; status: "Active"; environment: "Production"; owner: "Engineering"; tags: "${type.toLowerCase()}"; shape: "Rounded Rectangle"; visible: true; pos: (${135+index*180}, ${group.y+42}) }`));
    lines.push("}");
  }
  lines.push("","connections {");definition.connections.forEach(connection=>lines.push(`  ${connection}`));lines.push("}");return lines.join("\n");
}

export const workspacePalette:Record<DiagramType,Array<[string,string,string]>>={
  ARCHITECTURE:[["Service","◇","service"],["Database","◉","database"],["API Gateway","⌘","gateway"],["Queue","≡","queue"],["Cache","▱","cache"],["Storage","▤","storage"],["Container","⬡","container"],["Web App","▦","app"],["User","♙","external"],["Note","▤","note"]],
  DATABASE:[["Table","▦","database"],["Entity","▣","database"],["Junction","◇","database"],["View","▤","database"],["Index","≡","cache"],["Enum","⌗","storage"]],
  SEQUENCE:[["Actor","♙","external"],["Participant","◇","service"],["Service","▦","service"],["Database","◉","database"],["Queue","≡","queue"]],
  CLASS:[["Class","▦","service"],["Interface","◇","gateway"],["Abstract","▣","service"],["Enum","⌗","storage"],["Package","⬡","container"]],
  FLOW:[["Process","▦","service"],["Decision","◇","gateway"],["Input","▣","external"],["Database","◉","database"],["Start / End","●","storage"]],
};
