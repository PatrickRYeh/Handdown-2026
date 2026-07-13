'use server';

// Own-profile mutation (PRD §5.2). Editable: full_name, class_year, major,
// campus_region, avatar_url. RLS restricts the update to uid = auth.uid().
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required.').max(80),
  class_year: z
    .number()
    .int()
    .min(1950, 'Enter a valid class year.')
    .max(2100, 'Enter a valid class year.')
    .nullable(),
  major: z.string().trim().max(80).nullable(),
  campus_region: z.string().trim().max(40).nullable(),
  avatar_url: z.string().url().optional(), // only sent when a new photo was uploaded
});

export async function updateProfile(
  input: z.infer<typeof profileSchema>,
): Promise<{ error?: string }> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('uid', user.id)
    .select('uid');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Profile not found.' };

  revalidatePath('/profile');
  revalidatePath(`/profile/${user.id}`);
  return {};
}
