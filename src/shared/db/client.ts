// Prisma 클라이언트 (서버 전용, 프로세스당 1개 — 개발 중 HMR로 연결이 늘지 않게 전역에 보관)
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** 전역 인스턴스를 만든 생성 코드의 클래스 — 바뀌면(= prisma generate 후 다시 읽힘) 새로 만든다 */
  prismaClass?: typeof PrismaClient;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/**
 * 개발 서버에서 스키마를 바꾸고 `prisma generate` 하면 생성 코드가 다시 읽히지만,
 * 전역에 남은 옛 인스턴스는 새 칸(예: uploadId)을 몰라 "Unknown argument" 에러가 난다 (2026-10-20).
 * 생성 코드의 클래스가 바뀌었으면 옛 연결을 닫고 새로 만든다.
 */
function currentClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && globalForPrisma.prismaClass === PrismaClient) return cached;
  if (cached) void cached.$disconnect().catch(() => {});
  const client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaClass = PrismaClient;
  }
  return client;
}

export const prisma = currentClient();
