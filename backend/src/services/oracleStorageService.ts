import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import http from 'http';
import https from 'https';
import { env, validateMinioEnv } from '../config/env';
import { withTimeout } from '../utils/timeoutHelper';

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

      // Configure persistent HTTP/HTTPS agents with explicit keep-alive and socket error listeners
      const httpAgent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 50,
        timeout: 15000,
      });

      const httpsAgent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 50,
        timeout: 15000,
      });

      httpAgent.on('error', (err) => console.error('[MinIO httpAgent socket error]:', err));
      httpsAgent.on('error', (err) => console.error('[MinIO httpsAgent socket error]:', err));

      this.s3ClientInstance = new S3Client({
        endpoint,
        region: 'us-east-1', // Default region required by S3Client even for MinIO
        credentials: {
          accessKeyId: env.MINIO_ACCESS_KEY,
          secretAccessKey: env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true, // Crucial for MinIO/Oracle object storage
        requestHandler: new NodeHttpHandler({
          httpAgent,
          httpsAgent,
          connectionTimeout: 5000, // 5s TCP connection timeout
          requestTimeout: 15000,    // 15s socket request timeout
        }),
      });
    }
    return this.s3ClientInstance;
  }

  public static getBucketName(): string {
    return env.MINIO_BUCKET || 'ambeuploads';
  }

  /**
   * Checks if the storage bucket exists and is reachable.
   */
  public static async checkBucketExists(timeoutMs: number = 5000): Promise<boolean> {
    try {
      const client = this.getClient();
      const bucket = this.getBucketName();
      const command = new HeadBucketCommand({ Bucket: bucket });

      await withTimeout(client.send(command), timeoutMs, `MinIO:HeadBucket[${bucket}]`);
      return true;
    } catch (error: any) {
      console.warn(`⚠️ MinIO checkBucketExists failed:`, error?.message || error);
      return false;
    }
  }

  /**
   * Uploads a buffer to MinIO/Oracle S3 storage using PutObjectCommand with timeout.
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

      await withTimeout(client.send(command), 15000, `MinIO:PutObject[${key}]`);

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

      return await withTimeout(
        getSignedUrl(client, command, { expiresIn: expiresInSeconds }),
        5000,
        `MinIO:getSignedReadUrl[${key}]`
      );
    } catch (error: any) {
      console.error(`❌ MinIO getSignedReadUrl error for key [${key}]:`, error?.message || error);
      return '';
    }
  }

  /**
   * Fetches an object stream and metadata from MinIO/Oracle storage for direct server-side proxying.
   */
  public static async getObject(
    key: string
  ): Promise<{ body: any; contentType?: string; contentLength?: number }> {
    try {
      if (!key) throw new Error('Object key is required');
      const client = this.getClient();
      const bucket = this.getBucketName();

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await withTimeout(client.send(command), 15000, `MinIO:GetObject[${key}]`);
      return {
        body: response.Body,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error: any) {
      console.error(`❌ MinIO getObject error for key [${key}]:`, error?.message || error);
      throw error;
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

      await withTimeout(client.send(command), 10000, `MinIO:DeleteObject[${key}]`);
      return true;
    } catch (error: any) {
      console.error(`❌ MinIO deleteFile error for key [${key}]:`, error?.message || error);
      return false;
    }
  }
}
