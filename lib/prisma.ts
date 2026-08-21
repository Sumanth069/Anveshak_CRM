import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const directDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://postgres.uwuqylmtrlrjwihxzjul:AnveshakCRM@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: directDbUrl,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
