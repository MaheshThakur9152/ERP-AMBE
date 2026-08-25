import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];

/**
 * Checks buffer magic bytes for allowed types:
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47
 * - PDF: 25 50 44 46 (%PDF)
 * - WEBP: 52 49 46 46 (RIFF) + bytes 8..12 "WEBP"
 */
export function detectMagicMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Express middleware to validate that the uploaded file matches both declared MIME and magic bytes.
 */
export const validateFileMagicBytes = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file) {
    next();
    return;
  }

  const detectedMime = detectMagicMimeType(req.file.buffer);

  if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
    res.status(400).json({
      error: 'Invalid file signature: uploaded file does not match allowed types (PDF, PNG, JPEG, WEBP)',
    });
    return;
  }

  // Overwrite client-declared mimetype with verified signature mimetype
  req.file.mimetype = detectedMime;
  next();
};
