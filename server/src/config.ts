import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 5001),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").split(",").map(value => value.trim()),
  jwtSecret: process.env.JWT_SECRET ?? "development-only-secret",
};
