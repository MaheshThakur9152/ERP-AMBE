import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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
};
