// Client-side image compression + upload to Supabase Storage (PRD §6.4, §9).
// Phone photos are 5–10 MB; downscaling to ≤1600px JPEG before upload keeps
// publishes fast and the free storage tier roomy.
import { createClient } from '@/lib/supabase/client';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function compress(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (blob) return blob;
  } catch {
    // Fall through — some formats can't be decoded in this browser.
  }
  return file; // upload the original rather than failing the publish
}

/**
 * Compress and upload one listing photo. Files live under the listing's folder
 * ({listingId}/...) with unique names so replacing/reordering photos never
 * overwrites an old file. Returns the public URL.
 */
export async function uploadListingImage(
  listingId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const blob = await compress(file);
  const path = `${listingId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  return supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
}
