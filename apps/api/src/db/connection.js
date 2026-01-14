import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/** @type {{ prisma?: import("@prisma/client").PrismaClient }} */
const globalForPrisma = globalThis;

const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    console.log("Using DATABASE_URL with pg.Pool adapter...");
    const pool = new pg.Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log: ["error", "warn"],
    });
  }

  console.log("Using DB_HOST/DB_* env vars with pg.Pool adapter...");
  
  const config = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "cricket",
    user: process.env.DB_USER || "postgres",
  };

  if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim() !== "") {
    config.password = process.env.DB_PASSWORD;
  }

  const pool = new pg.Pool(config);
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
