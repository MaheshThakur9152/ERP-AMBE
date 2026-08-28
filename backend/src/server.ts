import app from './app';
import { env } from './config/env';
import { supabaseAdmin } from './config/supabase';
import { OracleStorageService } from './services/oracleStorageService';
import { withTimeout } from './utils/timeoutHelper';

const PORT = parseInt(env.PORT, 10) || 5000;

// Process-level failure traps to eliminate silent hangs in journalctl
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 [FATAL] Unhandled Promise Rejection at:', promise, 'reason:', reason?.stack || reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('🚨 [FATAL] Uncaught Exception thrown:', err?.stack || err);
  // Allow pending I/O to flush before exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('warning', (warning: Error) => {
  console.warn('⚠️ [Node Process Warning]:', warning.name, warning.message, warning.stack);
});

/**
 * Connection Pool Warmup: Executes a lightweight query and storage ping on server startup.
 */
async function warmupConnections() {
  try {
    const dbQuery = supabaseAdmin.from('companies').select('id').limit(1);
    const { error } = await withTimeout(dbQuery, 5000, 'Warmup:DB');
    if (error) {
      console.warn('⚠️ DB Connection warmup warning:', error.message);
    } else {
      console.log('✅ DB Connection warmed up successfully');
    }
  } catch (err: any) {
    console.warn('⚠️ DB Connection warmup error:', err.message);
  }

  try {
    const storageOk = await OracleStorageService.checkBucketExists(5000);
    if (storageOk) {
      console.log('✅ MinIO Storage warmed up successfully');
    } else {
      console.warn('⚠️ MinIO Storage warmup: bucket check failed or timed out');
    }
  } catch (err: any) {
    console.warn('⚠️ MinIO Storage warmup error:', err.message);
  }
}

const server = app.listen(PORT, () => {
  console.log(`🚀 ERP Backend API listening on port ${PORT} [${env.NODE_ENV}]`);
  warmupConnections();
});

// Graceful termination handling
const shutdown = (signal: string) => {
  console.log(`🛑 Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('✅ HTTP server closed. Process exiting.');
    process.exit(0);
  });
  // Force exit after 10s if hanging connections remain
  setTimeout(() => {
    console.error('🚨 Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
