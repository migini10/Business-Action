import { isHeic } from 'heic-to';

export const MAX_SOURCE_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_FINAL_FILE_SIZE = 4 * 1024 * 1024;

export async function convertIfHeic(file: File): Promise<File> {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  const isHeicMimeOrExt =
    mime.startsWith('image/heic') ||
    mime.startsWith('image/heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  // Check the file signature using heic-to utility
  const isActuallyHeic = await isHeic(file);

  if (!isHeicMimeOrExt && !isActuallyHeic) {
    return file; // Bypass JPEG/PNG etc.
  }

  // Dynamically import heic-to only when needed
  const { heicTo } = await import('heic-to');

  // Process conversion
  const convertedBlob = await heicTo({
    blob: file,
    type: 'image/jpeg',
    quality: 0.85
  });

  const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

  // Return the converted JPEG file
  return new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
}
