import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env, validateMinioEnv } from '../config/env';

export class OracleStorageService {
  private static s3ClientInstance: S3Client | null = null;

  private static getClient(): S3Client {
    if (!this.s3ClientInstance) {
      validateMinioEnv();

      // Normalize endpoint URL (ensure protocol is present)
      let endpoint = env.MINIO_ENDPOINT.trim();
      if (!/^https?:\/\//i.test(endpoint)) {
        endpoint = `http://${endpoint}`;
      }

      this.s3ClientInstance = new S3Client({
        endpoint,
        region: 'us-east-1', // Default region required by S3Client even for MinIO
        credentials: {
          accessKeyId: env.MINIO_ACCESS_KEY,
          secretAccessKey: env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true, // Crucial for MinIO/Oracle object storage
      });
    }
    return this.s3ClientInstance;
  }

  private static getBucketName(): string {
    return env.MINIO_BUCKET || 'ambeuploads';
  }

  /**
   * Uploads a buffer to MinIO/Oracle S3 storage using PutObjectCommand.
   */
  public static async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/octet-stream'
  ): Promise<{ storageKey: string; storageProvider: 'minio' }> {
    try {
      const client = this.getClient();
      const bucket = this.getBucketName();

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await client.send(command);

      return {
        storageKey: key,
        storageProvider: 'minio',
      };
    } catch (error: any) {
      console.error(`❌ MinIO upload error for key [${key}]:`, error?.message || error);
      throw new Error(`MinIO upload failed: ${error?.message || error}`);
    }
  }

  /**
   * Generates a pre-signed GET URL for reading an object.
   */
  public static async getSignedReadUrl(
    key: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    try {
      if (!key) return '';
      const client = this.getClient();
      const bucket = this.getBucketName();

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    } catch (error: any) {
      console.error(`❌ MinIO getSignedReadUrl error for key [${key}]:`, error?.message || error);
      return '';
    }
  }

  /**
   * Deletes an object from MinIO/Oracle storage for rollback/cleanup.
   */
  public static async deleteFile(key: string): Promise<boolean> {
    try {
      if (!key) return false;
      const client = this.getClient();
      const bucket = this.getBucketName();

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch (error: any) {
      console.error(`❌ MinIO deleteFile error for key [${key}]:`, error?.message || error);
      return false;
    }
  }
}
