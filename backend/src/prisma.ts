import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

let pool: pg.Pool | null = null;
let prisma: any;

try {
    pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000
    });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter }) as any;
} catch (error) {
    // Fallback for types and immediate initialization
    prisma = new PrismaClient() as any;
}

/** Disconnect the client and end the underlying pool so test workers can exit. */
export async function shutdownPrisma(): Promise<void> {
    try {
        await prisma.$disconnect();
    } catch {
        // already disconnected
    }
    if (pool) {
        try {
            await pool.end();
        } catch {
            // already ended
        }
    }
}

export { prisma };
export default prisma;
