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
import bonusRoutes from './bonusRoutes';
import attendanceCalculatorRoutes from './attendanceCalculatorRoutes';
import { OracleStorageService } from '../services/oracleStorageService';
import { RedisCacheService } from '../config/redis';
import { checkDbHealth } from '../db/pool';

const router = Router();

/**
 * Deep Health Check Endpoint
 * Actively pings native PostgreSQL Pool, MinIO Storage, and Redis cache.
 */
router.get('/health', async (_req, res) => {
  const start = Date.now();
  let storageOk = false;
  let storageError: string | null = null;

  // 1. Check PostgreSQL Pool
  const pgHealth = await checkDbHealth();

  // 2. Check MinIO Storage (4s timeout)
  try {
    storageOk = await OracleStorageService.checkBucketExists(4000);
    if (!storageOk) {
      storageError = 'Bucket unreachable or HeadBucket check timed out';
    }
  } catch (err: any) {
    storageError = err.message || 'Storage check timed out';
  }

  // 3. Check Redis Cache
  const redisOk = RedisCacheService.isAvailable();

  const durationMs = Date.now() - start;
  const isHealthy = pgHealth.ok && storageOk;

  const payload = {
    status: isHealthy ? 'healthy' : (pgHealth.ok || storageOk) ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    durationMs,
    services: {
      postgres: {
        status: pgHealth.ok ? 'up' : 'down',
        latencyMs: pgHealth.latencyMs,
        error: pgHealth.error || null,
      },
      storage: {
        status: storageOk ? 'up' : 'down',
        error: storageError,
      },
      redis: {
        status: redisOk ? 'up' : 'down',
      },
    },
  };

  res.status(isHealthy ? 200 : 503).json(payload);
});

import rateCardRoutes from './rateCardRoutes';
import deploymentRoutes from './deploymentRoutes';
import payrollRoutes from './payrollRoutes';

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
router.use('/rate-cards', rateCardRoutes);
router.use('/deployments', deploymentRoutes);
router.use('/payroll', payrollRoutes);
router.use('/bonus', bonusRoutes);
router.use('/attendance-calculator', attendanceCalculatorRoutes);

export default router;
