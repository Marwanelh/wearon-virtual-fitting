export const MODEL = process.env.FITTING_MODEL || 'wearon-vton';
export const SESSION_SECONDS = 15;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CAMERA_PROFILE = Object.freeze({ width: 1280, height: 720, fps: 30 });

export function referenceSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 25000000) throw new Error('Choose an image with fewer than 25 megapixels.');
  const scale = Math.min(1, 1024 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function imageError(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG, or WebP image.';
  if (!file.size || file.size > MAX_IMAGE_BYTES) return 'Choose an image smaller than 10 MB.';
  return '';
}

