import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { api } from "./routes.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { attachSocketServer } from "./socket.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(express.json({ limit: "6mb" }));
app.use("/api", api);

const server = createServer(app);
const io = attachSocketServer(server);
app.set("io", io);
server.listen(config.port, "127.0.0.1", () => console.log(`FrameLabs API listening on http://127.0.0.1:${config.port}`));

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
