import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || 'erp_admin'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'erp_facility'}`;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[pg:pool] Unexpected error on idle client:', err);
});

/**
 * Execute work inside an isolated ACID database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[pg:withTransaction] Rollback failed:', rollbackErr);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Pings database to check connectivity and roundtrip latency.
 */
export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT 1 as healthy');
    const latencyMs = Date.now() - start;
    if (res.rows?.[0]?.healthy === 1) {
      return { ok: true, latencyMs };
    }
    return { ok: false, latencyMs, error: 'Unexpected query response' };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
