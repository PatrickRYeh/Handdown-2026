'use server';

// Listing mutations (PRD §5.1). Server-side Zod validation on everything —
// client checks are UX, RLS is the real enforcement, this layer is the
// contract. All writes run as the signed-in user, so RLS blocks anything the
// UI shouldn't have allowed.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'used'] as const;
const CATEGORIES = ['furniture', 'apparel', 'electronics', 'books', 'other'] as const;

const listingFields = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  description: z.string().trim().min(1, 'Description is required.').max(2000),
  price_cents: z.number().int().positive('Price must be greater than 0.'),
  condition: z.enum(CONDITIONS),
  category: z.enum(CATEGORIES),
  region_id: z.string().trim().min(1, 'Location is required.'),
});

const imagesSchema = z
  .array(z.string().url())
  .min(1, 'At least one photo is required.')
  .max(10, 'At most 10 photos.');

const createSchema = listingFields.extend({
  // Client-generated so photos can be uploaded under the listing's storage
  // folder before the row exists.
  id: z.string().uuid(),
  images: imagesSchema,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  fields: listingFields.partial(),
  // Present only when the photo set/order changed; full ordered replacement.
  images: imagesSchema.optional(),
});

export type MutationResult = { id: string; error?: never } | { error: string; id?: never };

export async function createListing(
  input: z.infer<typeof createSchema>,
): Promise<MutationResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, images, ...fields } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { error: insertErr } = await supabase.from('listings').insert({
    id,
    offering_uid: user.id, // server-set; never trusted from the client
    ...fields,
    thumbnail_url: images[0],
    status: 'active',
  });
  if (insertErr) return { error: insertErr.message };

  const { error: imgErr } = await supabase.from('listing_images').insert(
    images.map((image_url, position) => ({ listing_id: id, image_url, position })),
  );
  if (imgErr) {
    // Don't leave a photo-less listing behind.
    await supabase.from('listings').delete().eq('id', id);
    return { error: imgErr.message };
  }

  revalidatePath('/campus');
  revalidatePath('/profile/listings');
  return { id };
}

export async function updateListing(
  input: z.infer<typeof updateSchema>,
): Promise<MutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, fields, images } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  if (Object.keys(fields).length > 0 || images) {
    const { data: updated, error } = await supabase
      .from('listings')
      .update({ ...fields, ...(images ? { thumbnail_url: images[0] } : {}) })
      .eq('id', id)
      .eq('offering_uid', user.id)
      .select('id');
    if (error) return { error: error.message };
    // RLS silently filters rows you don't own — zero rows means not yours.
    if (!updated?.length) return { error: 'Listing not found or not yours.' };
  }

  if (images) {
    // Full ordered replacement covers add, remove, and reorder in one shape.
    const { error: delErr } = await supabase
      .from('listing_images')
      .delete()
      .eq('listing_id', id);
    if (delErr) return { error: delErr.message };
    const { error: insErr } = await supabase.from('listing_images').insert(
      images.map((image_url, position) => ({ listing_id: id, image_url, position })),
    );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath('/campus');
  revalidatePath(`/listings/${id}`);
  revalidatePath('/profile/listings');
  return { id };
}

export async function deleteListing(id: string): Promise<MutationResult> {
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid id.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  // Soft delete (PRD §5.1): preserves conversation context. Never hard-delete.
  const { data: updated, error } = await supabase
    .from('listings')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('offering_uid', user.id)
    .select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Listing not found or not yours.' };

  revalidatePath('/campus');
  revalidatePath('/profile/listings');
  return { id };
}
