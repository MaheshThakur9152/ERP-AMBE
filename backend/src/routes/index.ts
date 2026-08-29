import { Router } from 'express';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import companyRoutes from './companyRoutes';
import excelRoutes from './excelRoutes';
import invoiceRoutes from './invoiceRoutes';
import siteRoutes from './siteRoutes';
import materialRoutes from './materialRoutes';
import documentRoutes from './documentRoutes';
import attendanceRoutes from './attendanceRoutes';
import staffRoutes from './staffRoutes';
import { supabaseAdmin } from '../config/supabase';
import { OracleStorageService } from '../services/oracleStorageService';
import { withTimeout } from '../utils/timeoutHelper';

const router = Router();

/**
 * Deep Health Check Endpoint
 * Actively pings DB (companies count query) and MinIO Storage (bucket existence check)
 * with 4s timeouts to catch hung connections immediately.
 */
router.get('/health', async (_req, res) => {
  const start = Date.now();
  let dbOk = false;
  let storageOk = false;
  let dbError: string | null = null;
  let storageError: string | null = null;

  // 1. Check Database (4s timeout)
  try {
    const dbQuery = supabaseAdmin.from('companies').select('id').limit(1);
    const { error } = await withTimeout(dbQuery, 4000, 'HealthCheck:Database');
    if (error) {
      dbError = error.message;
    } else {
      dbOk = true;
    }
  } catch (err: any) {
    dbError = err.message || 'Database check timed out';
  }

  // 2. Check MinIO Storage (4s timeout)
  try {
    storageOk = await OracleStorageService.checkBucketExists(4000);
    if (!storageOk) {
      storageError = 'Bucket unreachable or HeadBucket check timed out';
    }
  } catch (err: any) {
    storageError = err.message || 'Storage check timed out';
  }

  const durationMs = Date.now() - start;
  const isHealthy = dbOk && storageOk;

  const payload = {
    status: isHealthy ? 'healthy' : dbOk || storageOk ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    durationMs,
    services: {
      database: {
        status: dbOk ? 'up' : 'down',
        error: dbError,
      },
      storage: {
        status: storageOk ? 'up' : 'down',
        error: storageError,
      },
    },
  };

  res.status(isHealthy ? 200 : 503).json(payload);
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/companies', companyRoutes);
router.use('/excel', excelRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/sites', siteRoutes);
router.use('/materials', materialRoutes);
router.use('/documents', documentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/staff', staffRoutes);

export default router;
