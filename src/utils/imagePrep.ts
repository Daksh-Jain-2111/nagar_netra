/**
 * Prepares complaint photos for AI upload: decodes data-URL / remote photos, downscales them
 * (the model only needs ~224px; this keeps uploads small on mobile data) and re-encodes as JPEG.
 */

const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.85;

export interface PreparedPhotos {
  blobs: Blob[];
  /** Indexes (in the original photo list) that could not be read, e.g. remote image without CORS. */
  skipped: number[];
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  // `imageOrientation: 'from-image'` applies EXIF rotation in browsers that support it.
  return createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
}

async function toJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await loadBitmap(blob);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', JPEG_QUALITY),
  );
}

export async function preparePhotosForAI(photoUrls: string[], signal?: AbortSignal): Promise<PreparedPhotos> {
  const blobs: Blob[] = [];
  const skipped: number[] = [];
  for (let i = 0; i < photoUrls.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const response = await fetch(photoUrls[i], { mode: 'cors', signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const original = await response.blob();
      try {
        blobs.push(await toJpeg(original));
      } catch {
        // Browser could not decode/resize (e.g. HEIC on Chrome): let the server validate the original.
        blobs.push(original);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      skipped.push(i);
    }
  }
  return { blobs, skipped };
}

/** Stable key for a set of photos so a finished analysis can be reused when nothing changed. */
export function photoSetKey(photoUrls: string[]): string {
  let hash = 2166136261;
  const text = photoUrls.map(u => `${u.length}:${u.slice(0, 64)}:${u.slice(-64)}`).join('|');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${photoUrls.length}-${(hash >>> 0).toString(36)}`;
}
