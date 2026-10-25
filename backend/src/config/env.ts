import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  GCP_SERVICE_ACCOUNT_KEY: process.env.GCP_SERVICE_ACCOUNT_KEY || '',
  GCP_CLIENT_EMAIL: process.env.GCP_CLIENT_EMAIL || '',
  GCP_PRIVATE_KEY: process.env.GCP_PRIVATE_KEY || '',
  GCP_BUCKET_NAME: process.env.GCP_BUCKET_NAME || 'ambe-erp-documents',
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'ambeservicecloud',
  DRIVE_EMPLOYEE_FOLDER_ID: process.env.DRIVE_EMPLOYEE_FOLDER_ID || '',
  DRIVE_INVOICE_FOLDER_ID: process.env.DRIVE_INVOICE_FOLDER_ID || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || '',
  MINIO_PUBLIC_ENDPOINT: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_PUBLIC_URL || '',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || '',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || '',
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'ambeuploads',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: process.env.REDIS_PORT || '6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
};

export function validateMinioEnv(): void {
  const missing: string[] = [];
  if (!env.MINIO_ENDPOINT) missing.push('MINIO_ENDPOINT');
  if (!env.MINIO_ACCESS_KEY) missing.push('MINIO_ACCESS_KEY');
  if (!env.MINIO_SECRET_KEY) missing.push('MINIO_SECRET_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required MinIO/Oracle storage environment variables: ${missing.join(', ')}. Please set them in your .env file.`
    );
  }
}

export function validateJwtConfig(customSecret?: string): string {
  const secret = customSecret !== undefined ? customSecret : process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing, empty, or too short (minimum 32 characters required). Application cannot safely sign or verify tokens.'
    );
  }
  if (secret.includes('default-insecure-jwt-secret')) {
    throw new Error('FATAL: JWT_SECRET cannot be the insecure default placeholder.');
  }
  return secret;
}

