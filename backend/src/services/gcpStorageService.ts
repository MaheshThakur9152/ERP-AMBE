import { Storage } from '@google-cloud/storage';
import { env } from '../config/env';

function initStorage(): Storage {
  let credentials: any = null;

  if (env.GCP_CLIENT_EMAIL && env.GCP_PRIVATE_KEY) {
    credentials = {
      client_email: env.GCP_CLIENT_EMAIL,
      private_key: env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      project_id: env.GCP_PROJECT_ID,
    };
  } else if (env.GCP_SERVICE_ACCOUNT_KEY?.trim()) {
    const rawKey = env.GCP_SERVICE_ACCOUNT_KEY.trim();
    try {
      credentials = JSON.parse(rawKey);
    } catch {
      try {
        const decoded = Buffer.from(rawKey, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
      } catch {
        // Assume rawKey might be file path
      }
    }
  }

  if (credentials) {
    return new Storage({
      credentials,
      projectId: env.GCP_PROJECT_ID || credentials.project_id,
    });
  } else if (env.GCP_SERVICE_ACCOUNT_KEY && !env.GCP_SERVICE_ACCOUNT_KEY.startsWith('{')) {
    return new Storage({
      keyFilename: env.GCP_SERVICE_ACCOUNT_KEY,
      projectId: env.GCP_PROJECT_ID || undefined,
    });
  }

  return new Storage({
    projectId: env.GCP_PROJECT_ID || undefined,
  });
}

export class GCPStorageService {
  private static storage = initStorage();

  public static async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    staffId: string
  ): Promise<{ gcp_file_url: string; file_name: string }> {
    const bucketName = env.GCP_BUCKET_NAME || 'ambe-erp-documents';
    const bucket = this.storage.bucket(bucketName);

    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const destinationPath = `employee-docs/${staffId}/${Date.now()}-${safeName}`;
    const blob = bucket.file(destinationPath);

    return new Promise((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: mimeType,
      });

      blobStream.on('error', (err) => {
        console.error('❌ GCP Storage Upload Error:', err);
        reject(err);
      });

      blobStream.on('finish', async () => {
        try {
          const [signedUrl] = await blob.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour TTL
          });

          resolve({
            gcp_file_url: signedUrl,
            file_name: originalName,
          });
        } catch (signedErr: any) {
          console.error('❌ Failed to generate signed URL:', signedErr);
          reject(signedErr);
        }
      });

      blobStream.end(fileBuffer);
    });
  }

  /**
   * Upload site document with exact generated file name
   */
  public static async uploadSiteDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    siteId: string
  ): Promise<{ gcp_file_url: string; file_name: string }> {
    const bucketName = env.GCP_BUCKET_NAME || 'ambe-erp-documents';
    const bucket = this.storage.bucket(bucketName);
    const destinationPath = `site-docs/${siteId}/${fileName}`;
    const blob = bucket.file(destinationPath);

    return new Promise((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: mimeType,
      });

      blobStream.on('error', (err) => {
        console.error('❌ GCP Storage Site Doc Upload Error:', err);
        reject(err);
      });

      blobStream.on('finish', async () => {
        try {
          const [signedUrl] = await blob.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days TTL
          });

          resolve({
            gcp_file_url: signedUrl,
            file_name: fileName,
          });
        } catch (signedErr: any) {
          console.warn('⚠️ Could not generate signed URL, using fallback URL:', signedErr?.message);
          resolve({
            gcp_file_url: `https://storage.googleapis.com/${bucketName}/${destinationPath}`,
            file_name: fileName,
          });
        }
      });

      blobStream.end(fileBuffer);
    });
  }

  /**
   * Generates a fresh signed read URL for a stored GCP file path
   */
  public static async getSignedFileUrl(destinationPath: string, expiresInMs = 60 * 60 * 1000): Promise<string> {
    const bucketName = env.GCP_BUCKET_NAME || 'ambe-erp-documents';
    const bucket = this.storage.bucket(bucketName);
    const blob = bucket.file(destinationPath);
    const [signedUrl] = await blob.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
    });
    return signedUrl;
  }
}
