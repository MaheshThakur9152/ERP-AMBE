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
        let publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;

        try {
          await blob.makePublic();
        } catch (pubErr) {
          console.warn('⚠️ Could not set public ACL (uniform bucket access active), trying signed URL fallback.');
          try {
            const [signedUrl] = await blob.getSignedUrl({
              action: 'read',
              expires: '03-09-2099',
            });
            publicUrl = signedUrl;
          } catch (signedErr) {
            console.warn('⚠️ Defaulting to standard public URL.');
          }
        }

        resolve({
          gcp_file_url: publicUrl,
          file_name: originalName,
        });
      });

      blobStream.end(fileBuffer);
    });
  }
}
