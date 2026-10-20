import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_TIMEOUT_MS = 250; // Strict fail-open timeout (GATE-12)

let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  const options: RedisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    connectTimeout: REDIS_TIMEOUT_MS,
    commandTimeout: REDIS_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying and fail open
      }
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
    enableOfflineQueue: false, // Fail open immediately if offline
  };

  redisClient = new Redis(options);

  redisClient.on('connect', () => {
    isRedisAvailable = true;
    console.log(`✅ [Redis] Connected successfully to ${REDIS_HOST}:${REDIS_PORT}`);
  });

  redisClient.on('ready', () => {
    isRedisAvailable = true;
  });

  redisClient.on('error', (err) => {
    isRedisAvailable = false;
    console.warn(`⚠️ [Redis:FailOpen] Connection or command error (falling back to PG): ${err.message}`);
  });

  redisClient.on('close', () => {
    isRedisAvailable = false;
  });

  // Attempt non-blocking initial connection
  redisClient.connect().catch((err) => {
    isRedisAvailable = false;
    console.warn(`⚠️ [Redis:FailOpen] Initial connect failed (operating in fail-open mode): ${err.message}`);
  });
} catch (err: any) {
  isRedisAvailable = false;
  console.warn(`⚠️ [Redis:FailOpen] Failed to initialize Redis client: ${err.message}`);
}

export const RedisCache = {
  isAvailable(): boolean {
    return isRedisAvailable && redisClient?.status === 'ready';
  },

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable() || !redisClient) return null;
    try {
      const data = await Promise.race([
        redisClient.get(key),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Redis get timeout')), REDIS_TIMEOUT_MS)),
      ]);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null; // Fail-open: return null on any error or timeout
    }
  },

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.isAvailable() || !redisClient) return;
    try {
      const serialized = JSON.stringify(value);
      await Promise.race([
        redisClient.set(key, serialized, 'EX', ttlSeconds),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Redis set timeout')), REDIS_TIMEOUT_MS)),
      ]);
    } catch {
      // Fail-open: ignore cache write failure
    }
  },

  async del(key: string): Promise<void> {
    if (!this.isAvailable() || !redisClient) return;
    try {
      await redisClient.del(key);
    } catch {
      // Fail-open: ignore deletion failure
    }
  },

  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.isAvailable() || !redisClient) return;
    try {
      const stream = redisClient.scanStream({
        match: `${prefix}*`,
        count: 50,
      });
      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          const pipeline = redisClient!.pipeline();
          keys.forEach((k) => pipeline.del(k));
          await pipeline.exec().catch(() => {});
        }
      });
    } catch {
      // Fail-open
    }
  },

  getClient(): Redis | null {
    return redisClient;
  },
};

export const RedisCacheService = RedisCache;
