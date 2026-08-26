import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const execFileAsync = promisify(execFile);

export class CompressionService {
  /**
   * Compresses an image buffer using Sharp:
   * Resize to max width 2000px, quality 80.
   */
  public static async compressImage(
    inputBuffer: Buffer,
    mimeType: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const normalizedMime = mimeType.toLowerCase();

      if (normalizedMime === 'image/png') {
        const compressed = await sharp(inputBuffer)
          .resize({ width: 2000, withoutEnlargement: true, fit: 'inside' })
          .png({ quality: 80, compressionLevel: 8 })
          .toBuffer();
        return { buffer: compressed, mimeType: 'image/png' };
      }

      if (normalizedMime === 'image/webp') {
        const compressed = await sharp(inputBuffer)
          .resize({ width: 2000, withoutEnlargement: true, fit: 'inside' })
          .webp({ quality: 80 })
          .toBuffer();
        return { buffer: compressed, mimeType: 'image/webp' };
      }

      // Default to JPEG
      const compressed = await sharp(inputBuffer)
        .resize({ width: 2000, withoutEnlargement: true, fit: 'inside' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

      return { buffer: compressed, mimeType: 'image/jpeg' };
    } catch (err) {
      console.warn('⚠️ Image compression warning, using original buffer:', err);
      return { buffer: inputBuffer, mimeType };
    }
  }

  /**
   * Compresses PDF using Ghostscript if available, otherwise fallbacks to pdf-lib.
   */
  public static async compressPDF(inputBuffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
    // 1. Try Ghostscript first
    try {
      const tempDir = os.tmpdir();
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const inputPath = path.join(tempDir, `gs_in_${uniqueSuffix}.pdf`);
      const outputPath = path.join(tempDir, `gs_out_${uniqueSuffix}.pdf`);

      await fs.promises.writeFile(inputPath, inputBuffer);

      try {
        await execFileAsync(
          'gs',
          [
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/ebook',
            '-dNOPAUSE',
            '-dQUIET',
            '-dBATCH',
            `-sOutputFile=${outputPath}`,
            inputPath,
          ],
          { timeout: 15000 }
        );

        if (fs.existsSync(outputPath)) {
          const compressed = await fs.promises.readFile(outputPath);
          if (compressed && compressed.length > 0) {
            return { buffer: compressed, mimeType: 'application/pdf' };
          }
        }
      } finally {
        // Clean up temp files
        fs.promises.unlink(inputPath).catch(() => {});
        fs.promises.unlink(outputPath).catch(() => {});
      }
    } catch (gsErr) {
      // Ghostscript not found or failed, proceeding to pdf-lib fallback
      console.warn('ℹ️ Ghostscript unavailable or skipped, falling back to pdf-lib compression');
    }

    // 2. Fallback to pdf-lib
    try {
      const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      return { buffer: Buffer.from(compressedBytes), mimeType: 'application/pdf' };
    } catch (pdfLibErr) {
      console.warn('⚠️ PDF compression failed, returning original buffer:', pdfLibErr);
      return { buffer: inputBuffer, mimeType: 'application/pdf' };
    }
  }

  /**
   * Main entrypoint for file compression before storage.
   */
  public static async compressFile(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const lowerMime = (mimeType || '').toLowerCase();

    if (lowerMime === 'application/pdf') {
      return this.compressPDF(fileBuffer);
    }

    if (
      lowerMime.startsWith('image/') ||
      lowerMime === 'image/jpeg' ||
      lowerMime === 'image/png' ||
      lowerMime === 'image/webp'
    ) {
      return this.compressImage(fileBuffer, lowerMime);
    }

    // Unsupported for compression, return as-is
    return { buffer: fileBuffer, mimeType };
  }
}
