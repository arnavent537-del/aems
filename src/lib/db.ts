import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// Avoid instantiating multiple Prisma Client instances in development due to hot reloading.
declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

const dbPath = "file:" + path.resolve(process.cwd(), "prisma/dev.db");

if (process.env.NODE_ENV === "production") {
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.prisma) {
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    global.prisma = new PrismaClient({ adapter });
  }
  prisma = global.prisma;
}

export { prisma };
