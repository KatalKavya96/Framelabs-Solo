import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const dsl = `diagram SystemArchitecture {
  title: "E-Commerce Platform Architecture"
  description: "High level system architecture"
}

group "Client Layer" at (245, 34) size (410, 100) color blue {
  web [Web Application] { type: app; tech: "React + TypeScript"; desc: "Customer-facing commerce application"; color: blue; pos: (360, 58) }
}

group "Edge & API" at (245, 178) size (410, 100) color purple {
  gateway [API Gateway] { type: gateway; tech: "Kong"; desc: "Routes and secures API traffic"; color: purple; pos: (360, 201) }
}

group "Services" at (110, 316) size (680, 112) color teal {
  auth [Auth Service] { type: service; tech: "Node.js"; desc: "Handles authentication and authorization"; color: teal; pos: (128, 343) }
  user [User Service] { type: service; tech: "Node.js"; desc: "Owns customer profiles"; color: teal; pos: (361, 343) }
  order [Order Service] { type: service; tech: "Node.js"; desc: "Coordinates order workflows"; color: teal; pos: (594, 343) }
}

group "Data Layer" at (96, 486) size (710, 112) color amber {
  db [PostgreSQL] { type: database; tech: "Primary Database"; desc: "Durable relational data"; color: amber; pos: (128, 514) }
  cache [Redis Cache] { type: cache; tech: "Session Store"; desc: "Low-latency session cache"; color: amber; pos: (361, 514) }
  storage [S3 Storage] { type: storage; tech: "File Storage"; desc: "Object and asset storage"; color: amber; pos: (594, 514) }
}

group "External Services" at (176, 655) size (550, 104) color blue {
  email [SendGrid] { type: external; tech: "Email Service"; desc: "Transactional notifications"; color: blue; pos: (232, 682) }
  payments [Stripe] { type: external; tech: "Payment Gateway"; desc: "Payment processing"; color: blue; pos: (493, 682) }
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

async function seed() {
  const passwordHash = await bcrypt.hash("framelabs-demo", 12);
  const users = [
    { id: "demo-user", email: "alex@framelabs.dev", name: "Alex Morgan" },
    { id: "sara-user", email: "sara@framelabs.dev", name: "Sara Kim" },
    { id: "jordan-user", email: "jordan@framelabs.dev", name: "Jordan Diaz" },
  ];
  for (const user of users) await prisma.user.upsert({ where: { id: user.id }, create: { ...user, passwordHash }, update: { name: user.name, email: user.email, passwordHash } });

  const organization = await prisma.organization.upsert({ where: { slug: "acme" }, create: { id: "acme-org", name: "Acme Engineering", slug: "acme" }, update: { name: "Acme Engineering" } });
  for (const [index, user] of users.entries()) await prisma.membership.upsert({ where: { userId_organizationId: { userId: user.id, organizationId: organization.id } }, create: { userId: user.id, organizationId: organization.id, role: index === 0 ? "OWNER" : "MEMBER" }, update: {} });

  const workspace = await prisma.workspace.upsert({ where: { organizationId_slug: { organizationId: organization.id, slug: "acme-workspace" } }, create: { id: "acme-workspace", organizationId: organization.id, name: "Acme Workspace", slug: "acme-workspace" }, update: { name: "Acme Workspace" } });
  const project = await prisma.project.upsert({ where: { workspaceId_slug: { workspaceId: workspace.id, slug: "infrastructure-docs" } }, create: { id: "infrastructure-project", workspaceId: workspace.id, name: "Infrastructure Docs", slug: "infrastructure-docs", description: "Living architecture documentation" }, update: { description: "Living architecture documentation" } });
  const diagram = await prisma.diagram.upsert({
    where: { id: "architecture-diagram" },
    create: { id: "architecture-diagram", projectId: project.id, title: "E-Commerce Platform Architecture", description: "High level system architecture", type: "ARCHITECTURE", dsl, modelJson: "{}", tagsJson: JSON.stringify(["architecture", "production", "commerce"]), createdById: "demo-user", updatedById: "demo-user" },
    update: {},
  });
  await prisma.diagramVersion.upsert({
    where: { diagramId_versionNumber: { diagramId: diagram.id, versionNumber: 1 } },
    create: { diagramId: diagram.id, versionNumber: 1, revision: 1, title: diagram.title, description: diagram.description, dsl: diagram.dsl, modelJson: diagram.modelJson, summary: "Initial architecture", actorId: "demo-user" }, update: {},
  });
  for (const userId of ["sara-user", "jordan-user"]) await prisma.diagramCollaborator.upsert({ where: { diagramId_userId: { diagramId: diagram.id, userId } }, create: { diagramId: diagram.id, userId, permission: "EDIT" }, update: {} });
  const specialized = [
    { id:"database-diagram", title:"Commerce Database Schema", type:"DATABASE", group:"Domain Tables", color:"blue", nodes:[["users","Users","database"],["orders","Orders","database"],["products","Products","database"]], connections:["users -> orders : \"1:N\"","products -> orders : \"N:M\""] },
    { id:"sequence-diagram", title:"Checkout Request Sequence", type:"SEQUENCE", group:"Participants", color:"purple", nodes:[["customer","Customer","external"],["web","Web App","app"],["api","Checkout API","gateway"],["db","Database","database"]], connections:["customer -> web : \"Checkout\"","web -> api : \"POST /orders\"","api -> db : \"Persist\""] },
    { id:"class-diagram", title:"Order Domain Classes", type:"CLASS", group:"Domain Model", color:"teal", nodes:[["user","User","service"],["order","Order","service"],["product","Product","service"]], connections:["user -> order : \"association\"","order -> product : \"aggregation\""] },
    { id:"flow-diagram", title:"Order Fulfilment Flow", type:"FLOW", group:"Process", color:"amber", nodes:[["start","Order Received","external"],["validate","Validate Stock","service"],["decision","Available?","gateway"],["complete","Dispatch","storage"]], connections:["start -> validate","validate -> decision","decision -> complete : \"yes\""] },
  ];
  for (const item of specialized) {
    const lines=[`diagram ${item.type} {`,`  title: "${item.title}"`,`  description: "Specialized ${item.type.toLowerCase()} engineering workspace"`,`}`,"",`group "${item.group}" at (100, 100) size (${Math.max(540,item.nodes.length*185)}, 135) color ${item.color} visible true {`];
    item.nodes.forEach(([alias,label,kind],index)=>lines.push(`  ${alias} [${label}] { type: ${kind}; tech: "${kind}"; desc: "${label} component"; color: ${item.color}; status: "Active"; environment: "Production"; owner: "Platform Team"; tags: "${item.type.toLowerCase()}"; shape: "Rounded Rectangle"; visible: true; pos: (${135+index*180}, 145) }`));
    lines.push("}","","connections {");item.connections.forEach(connection=>lines.push(`  ${connection}`));lines.push("}");const itemDsl=lines.join("\n");
    const created=await prisma.diagram.upsert({where:{id:item.id},create:{id:item.id,projectId:project.id,title:item.title,description:`Specialized ${item.type.toLowerCase()} engineering workspace`,type:item.type,dsl:itemDsl,modelJson:"{}",tagsJson:JSON.stringify([item.type.toLowerCase(),"engineering"]),createdById:"demo-user",updatedById:"demo-user"},update:{}});
    await prisma.diagramVersion.upsert({where:{diagramId_versionNumber:{diagramId:created.id,versionNumber:1}},create:{diagramId:created.id,versionNumber:1,revision:1,title:created.title,description:created.description,dsl:created.dsl,modelJson:created.modelJson,summary:`Initial ${item.type.toLowerCase()} workspace`,actorId:"demo-user"},update:{}});
  }
  console.log(`Seeded ${organization.name} / ${project.name} / ${diagram.title}`);
}

seed().finally(() => prisma.$disconnect());
