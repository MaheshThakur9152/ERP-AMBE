import { RedisCache } from '../src/config/redis';
import { pool } from '../src/db/pool';

async function runRedisTests() {
  console.log('--- STARTING GATE-12 REDIS CACHING & FAIL-OPEN TEST SUITE ---');
  let failures = 0;

  try {
    // Wait up to 3s for Redis ready
    let attempts = 0;
    while (!RedisCache.isAvailable() && attempts < 15) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }

    const available = RedisCache.isAvailable();
    console.log(`Redis Available: ${available}`);

    // TEST 1: Cache Set & Get roundtrip
    console.log('TEST 1: Cache Set & Get...');
    const testKey = 'erp:test:unit_gate12';
    const testPayload = { id: 'test_1', name: 'Alpha Facility', timestamp: Date.now() };

    await RedisCache.set(testKey, testPayload, 60);
    const retrieved = await RedisCache.get<typeof testPayload>(testKey);

    if (retrieved && retrieved.name === 'Alpha Facility' && retrieved.timestamp === testPayload.timestamp) {
      console.log('PASS: Cache roundtrip verified with matching payload');
    } else {
      console.error('FAIL: Cache retrieved data does not match stored payload');
      failures++;
    }

    // TEST 2: Invalidation via Prefix
    console.log('TEST 2: Prefix Invalidation...');
    const key1 = 'erp:test_prefix:item1';
    const key2 = 'erp:test_prefix:item2';
    await RedisCache.set(key1, { v: 1 }, 60);
    await RedisCache.set(key2, { v: 2 }, 60);

    await RedisCache.invalidatePrefix('erp:test_prefix:');
    // Allow scan & del to complete
    await new Promise((r) => setTimeout(r, 100));

    const check1 = await RedisCache.get(key1);
    const check2 = await RedisCache.get(key2);

    if (!check1 && !check2) {
      console.log('PASS: InvalidatePrefix successfully purged matched keys');
    } else {
      console.error('FAIL: InvalidatePrefix left residual keys in cache');
      failures++;
    }

    // TEST 3: Fail-Open verification with non-existent or down key
    console.log('TEST 3: Fail-open guarantee...');
    const nonExistent = await RedisCache.get('erp:completely:non:existent:key');
    if (nonExistent === null) {
      console.log('PASS: Non-existent key returns null fail-open');
    } else {
      console.error('FAIL: Expected null for missing cache key');
      failures++;
    }

    // Clean up test key
    await RedisCache.del(testKey);

    console.log(`\n--- GATE-12 TEST RUN COMPLETED. FAILURES: ${failures} ---`);
    process.exit(failures > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
  }
}

runRedisTests();
