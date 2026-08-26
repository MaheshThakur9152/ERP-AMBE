import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import { env } from '../config/env';

function initDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

const drive = initDriveClient();

async function getOrCreateDriveFolder(folderName: string, parentId: string): Promise<string> {
  const cleanName = folderName.trim().replace(/[\/\\:*?"<>|]/g, '_') || 'Unknown';
  const safeQueryName = cleanName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  // Check if folder already exists
  const listRes = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${safeQueryName}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    return listRes.data.files[0].id!;
  }

  // Create new folder
  const createRes = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return createRes.data.id!;
}

export interface UploadDriveFileParams {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  employeeName: string;
  docType: string;
  siteName?: string;
  designation?: string;
}

export interface UploadCompanyDriveFileParams {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  generatedName?: string;
  entity: string;
  year: string;
  month: string;
}

export class GoogleDriveService {
  public static async uploadEmployeeDocument({
    fileBuffer,
    originalName,
    mimeType,
    employeeName,
    docType,
    siteName,
    designation,
  }: UploadDriveFileParams): Promise<{ id: string; name: string; webViewLink: string }> {
    const ext = path.extname(originalName) || '';
    const cleanEmployeeName = employeeName.trim().replace(/[^a-zA-Z0-9_\s-]/g, '').replace(/\s+/g, '_');
    const cleanDocType = docType.trim().replace(/[^a-zA-Z0-9_\s-]/g, '').replace(/\s+/g, '_');
    const cleanFileName = `${cleanEmployeeName}_${cleanDocType}${ext}`;

    const rootFolderId = env.DRIVE_EMPLOYEE_FOLDER_ID || process.env.DRIVE_EMPLOYEE_FOLDER_ID || '';

    let targetFolderId = rootFolderId;

    // Build dynamic folder tree: Site -> Designation -> Employee Name
    if (rootFolderId) {
      if (siteName && siteName.trim()) {
        targetFolderId = await getOrCreateDriveFolder(siteName, rootFolderId);
      }
      if (designation && designation.trim()) {
        targetFolderId = await getOrCreateDriveFolder(designation, targetFolderId);
      }
      if (employeeName && employeeName.trim()) {
        targetFolderId = await getOrCreateDriveFolder(employeeName, targetFolderId);
      }
    }

    const stream = Readable.from(fileBuffer);

    const response = await drive.files.create({
      requestBody: {
        name: cleanFileName,
        parents: targetFolderId ? [targetFolderId] : undefined,
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    const fileId = response.data.id;

    return {
      id: fileId || '',
      name: response.data.name || cleanFileName,
      webViewLink: response.data.webViewLink || '',
    };
  }

  public static async uploadCompanyDocument({
    fileBuffer,
    originalName,
    mimeType,
    generatedName,
    entity,
    year,
    month,
  }: UploadCompanyDriveFileParams): Promise<{ id: string; name: string; webViewLink: string }> {
    const fileName = generatedName || originalName;
    const rootFolderId =
      env.DRIVE_INVOICE_FOLDER_ID ||
      process.env.DRIVE_INVOICE_FOLDER_ID ||
      env.DRIVE_EMPLOYEE_FOLDER_ID ||
      process.env.DRIVE_EMPLOYEE_FOLDER_ID ||
      '';

    let targetFolderId = rootFolderId;

    if (rootFolderId) {
      if (entity && entity.trim()) {
        targetFolderId = await getOrCreateDriveFolder(entity, rootFolderId);
      }
      if (year && year.trim()) {
        targetFolderId = await getOrCreateDriveFolder(year, targetFolderId);
      }
      if (month && month.trim()) {
        targetFolderId = await getOrCreateDriveFolder(month, targetFolderId);
      }
    }

    const stream = Readable.from(fileBuffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: targetFolderId ? [targetFolderId] : undefined,
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id || '',
      name: response.data.name || fileName,
      webViewLink: response.data.webViewLink || '',
    };
  }

  public static async uploadSingleFolderFile({
    fileBuffer,
    fileName,
    mimeType,
  }: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ id: string; name: string; webViewLink: string }> {
    const rootFolderId =
      env.DRIVE_INVOICE_FOLDER_ID ||
      process.env.DRIVE_INVOICE_FOLDER_ID ||
      env.DRIVE_EMPLOYEE_FOLDER_ID ||
      process.env.DRIVE_EMPLOYEE_FOLDER_ID ||
      '';

    const stream = Readable.from(fileBuffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: rootFolderId ? [rootFolderId] : undefined,
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id || '',
      name: response.data.name || fileName,
      webViewLink: response.data.webViewLink || '',
    };
  }

  public static async uploadSiteDocumentFile({
    fileBuffer,
    fileName,
    mimeType,
    siteName,
  }: {
    fileBuffer: Buffer;
    fileName: string;
    mimeType: string;
    siteName?: string;
  }): Promise<{ id: string; name: string; webViewLink: string }> {
    const rootFolderId =
      process.env.DRIVE_SITE_FOLDER_ID ||
      env.DRIVE_INVOICE_FOLDER_ID ||
      process.env.DRIVE_INVOICE_FOLDER_ID ||
      env.DRIVE_EMPLOYEE_FOLDER_ID ||
      process.env.DRIVE_EMPLOYEE_FOLDER_ID ||
      '';

    let targetFolderId = rootFolderId;
    if (rootFolderId && siteName && siteName.trim()) {
      try {
        targetFolderId = await getOrCreateDriveFolder(siteName, rootFolderId);
      } catch (folderErr) {
        console.warn('⚠️ Google Drive site folder creation warning:', folderErr);
      }
    }

    const stream = Readable.from(fileBuffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: targetFolderId ? [targetFolderId] : undefined,
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id || '',
      name: response.data.name || fileName,
      webViewLink: response.data.webViewLink || '',
    };
  }

  public static async getMimeType(fileId: string): Promise<string> {
    const meta = await drive.files.get({ fileId, fields: 'mimeType' });
    return meta.data.mimeType || 'application/octet-stream';
  }

  public static async streamFile(fileId: string): Promise<NodeJS.ReadableStream> {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return response.data as unknown as NodeJS.ReadableStream;
  }
}
