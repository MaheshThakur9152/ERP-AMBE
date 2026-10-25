import assert from 'assert';
import { env } from '../config/env';
import { OracleStorageService } from '../services/oracleStorageService';
import { viewDocumentProxy } from '../controllers/documentController';
import { pool } from '../db/pool';

console.log('--- Running MinIO Document Preview Verification Tests ---');

async function runTests() {
  // 1. Requirement 1, 2, 3, 4: Separate S3 client & Public HTTPS presigned URL generation
  console.log('Testing Public HTTPS Presigned URL generation and S3 Client separation...');
  env.MINIO_ENDPOINT = 'http://minio:9000';
  env.MINIO_PUBLIC_ENDPOINT = 'https://storage.ambeservice.com';
  env.MINIO_ACCESS_KEY = 'test_access_key';
  env.MINIO_SECRET_KEY = 'test_secret_key_123456789012345678';
  env.MINIO_BUCKET = 'ambeuploads';

  process.env.MINIO_ENDPOINT = 'http://minio:9000';
  process.env.MINIO_PUBLIC_ENDPOINT = 'https://storage.ambeservice.com';
  process.env.MINIO_ACCESS_KEY = 'test_access_key';
  process.env.MINIO_SECRET_KEY = 'test_secret_key_123456789012345678';
  process.env.MINIO_BUCKET = 'ambeuploads';

  OracleStorageService.resetClients();

  const internalClient = OracleStorageService.getInternalClient();
  const publicClient = OracleStorageService.getPublicClient();

  const internalEndpoint = await (internalClient.config as any).endpoint();
  const publicEndpoint = await (publicClient.config as any).endpoint();

  assert.strictEqual(
    `${internalEndpoint.protocol}//${internalEndpoint.hostname}:${internalEndpoint.port}`,
    'http://minio:9000',
    'Internal client must remain configured for Docker networking (http://minio:9000)'
  );

  assert.strictEqual(
    `${publicEndpoint.protocol}//${publicEndpoint.hostname}`,
    'https://storage.ambeservice.com',
    'Public client must be configured with HTTPS public endpoint (https://storage.ambeservice.com)'
  );

  const testKey = 'invoices/AMBE-SERVICE/2026/June/Legacy-Tax-Invoice-9491dec0.jpg';
  const signedUrl = await OracleStorageService.getSignedReadUrl(testKey, 3600);

  assert.ok(signedUrl, 'Signed URL must not be empty');
  assert.ok(
    signedUrl.startsWith('https://storage.ambeservice.com/ambeuploads/'),
    `Signed URL must start with https://storage.ambeservice.com/ambeuploads/, got: ${signedUrl}`
  );
  assert.ok(!signedUrl.includes('minio:9000'), 'Signed URL must never leak internal minio:9000 hostname');
  assert.ok(signedUrl.includes('X-Amz-Signature='), 'Signed URL must contain SigV4 signature');
  assert.ok(signedUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'), 'Signed URL must contain AWS4 algorithm');

  console.log('✓ Public S3 client generates HTTPS signed URLs with public hostname and SigV4.');

  // 2. Requirement 6: 404 distinction in viewDocumentProxy
  console.log('Testing 404 distinction (DOCUMENT_RECORD_NOT_FOUND, DOCUMENT_STORAGE_KEY_MISSING, STORAGE_OBJECT_NOT_FOUND)...');

  const originalPoolQuery = pool.query;
  try {
    // Case A: Missing database record
    (pool as any).query = async () => ({ rows: [] });

    let resCode = 0;
    let resJson: any = null;
    const mockResRecordNotFound: any = {
      status: (code: number) => {
        resCode = code;
        return mockResRecordNotFound;
      },
      json: (data: any) => {
        resJson = data;
        return mockResRecordNotFound;
      },
    };

    const reqRecordNotFound: any = {
      params: { documentId: '00000000-0000-0000-0000-000000000099' },
      query: {},
      user: { id: 'super-1', role: 'superadmin' },
    };

    await viewDocumentProxy(reqRecordNotFound, mockResRecordNotFound);
    assert.strictEqual(resCode, 404);
    assert.strictEqual(resJson.code, 'DOCUMENT_RECORD_NOT_FOUND');
    console.log('✓ Missing database record returns 404 with DOCUMENT_RECORD_NOT_FOUND.');

    // Case B: Document record exists but has no storage key
    (pool as any).query = async (queryText: string, params: any[]) => {
      if (typeof queryText === 'string' && queryText.includes('public.employee_documents')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              storage_key: null,
              gcp_file_url: null,
              storage_provider: 'minio',
              staff_id: 'staff-1',
            },
          ],
        };
      }
      return { rows: [] };
    };

    resCode = 0;
    resJson = null;
    const reqStorageKeyMissing: any = {
      params: { documentId: '00000000-0000-0000-0000-000000000001' },
      query: {},
      user: { id: 'super-1', role: 'superadmin' },
    };

    await viewDocumentProxy(reqStorageKeyMissing, mockResRecordNotFound);
    assert.strictEqual(resCode, 404);
    assert.strictEqual(resJson.code, 'DOCUMENT_STORAGE_KEY_MISSING');
    console.log('✓ Missing storage key returns 404 with DOCUMENT_STORAGE_KEY_MISSING.');

    // Case C: Object not found in MinIO (NoSuchKey)
    (pool as any).query = async (queryText: string, params: any[]) => {
      if (typeof queryText === 'string' && queryText.includes('public.employee_documents')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000002',
              storage_key: 'documents/nonexistent.pdf',
              gcp_file_url: null,
              storage_provider: 'minio',
              staff_id: 'staff-1',
            },
          ],
        };
      }
      return { rows: [] };
    };

    const originalGetObject = OracleStorageService.getObject;
    (OracleStorageService as any).getObject = async () => {
      const err: any = new Error('The specified key does not exist.');
      err.name = 'NoSuchKey';
      err.Code = 'NoSuchKey';
      throw err;
    };

    resCode = 0;
    resJson = null;
    const reqObjectNotFound: any = {
      params: { documentId: '00000000-0000-0000-0000-000000000002' },
      query: {},
      user: { id: 'super-1', role: 'superadmin' },
    };

    await viewDocumentProxy(reqObjectNotFound, mockResRecordNotFound);
    assert.strictEqual(resCode, 404);
    assert.strictEqual(resJson.code, 'STORAGE_OBJECT_NOT_FOUND');
    console.log('✓ Missing MinIO object returns 404 with STORAGE_OBJECT_NOT_FOUND.');

    // Case D: Requirement 8: Company scoping authorization check
    (pool as any).query = async (queryText: string, params: any[]) => {
      if (typeof queryText === 'string' && queryText.includes('public.company_documents')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000003',
              storage_key: 'documents/comp.pdf',
              company_id: 'company-a',
              storage_provider: 'minio',
            },
          ],
        };
      }
      return { rows: [] };
    };

    resCode = 0;
    resJson = null;
    const reqUnauthorizedTenant: any = {
      params: { documentId: '00000000-0000-0000-0000-000000000003' },
      query: {},
      user: { id: 'user-b', role: 'admin', company_id: 'company-b' },
    };

    await viewDocumentProxy(reqUnauthorizedTenant, mockResRecordNotFound);
    assert.strictEqual(resCode, 403);
    assert.ok(resJson.error.includes('Unauthorized document access'));
    console.log('✓ Cross-tenant document access rejected with 403.');

    (OracleStorageService as any).getObject = originalGetObject;
  } finally {
    pool.query = originalPoolQuery;
  }

  console.log('All MinIO Document Preview Verification Tests Passed Successfully! ✓');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
