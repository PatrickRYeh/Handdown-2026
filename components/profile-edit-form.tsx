'use client';

// Edit-own-profile form (PRD §6.7, §5.2): name, class year, major, campus
// region, avatar photo.
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { updateProfile } from '@/app/profile/actions';
import { uploadAvatar } from '@/lib/image-upload';
import { Avatar } from '@/components/avatar';
import type { Profile } from '@/lib/types';

const REGIONS = ['Southside', 'Northside', 'Downtown', 'Westbrae', 'Other'];

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [fullName, setFullName] = useState(profile.full_name);
  const [classYear, setClassYear] = useState(
    profile.class_year?.toString() ?? '',
  );
  const [major, setMajor] = useState(profile.major ?? '');
  const [region, setRegion] = useState(profile.campus_region ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Name is required.');
      return;
    }
    const yearNum = classYear ? Number.parseInt(classYear, 10) : null;
    if (classYear && (Number.isNaN(yearNum!) || yearNum! < 1950 || yearNum! > 2100)) {
      setError('Enter a valid class year (e.g. 2027).');
      return;
    }

    setSaving(true);
    try {
      let avatar_url: string | undefined;
      if (avatarFile) {
        avatar_url = await uploadAvatar(profile.uid, avatarFile);
      }
      const result = await updateProfile({
        full_name: fullName.trim(),
        class_year: yearNum,
        major: major.trim() || null,
        campus_region: region || null,
        ...(avatar_url ? { avatar_url } : {}),
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
      router.push('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pb-10">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-2 py-2">
        {avatarPreview ? (
          // Local preview is a blob: URL — next/image can't optimize those.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarPreview}
            alt="New profile photo preview"
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <Avatar name={profile.full_name} url={profile.avatar_url} size={96} />
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-brand hover:underline"
        >
          Change photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
            e.target.value = '';
          }}
        />
      </div>

      <Field label="Full name" htmlFor="full_name">
        <input
          id="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={80}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Class year" htmlFor="class_year">
          <input
            id="class_year"
            type="number"
            inputMode="numeric"
            placeholder="2027"
            value={classYear}
            onChange={(e) => setClassYear(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Major" htmlFor="major">
          <input
            id="major"
            type="text"
            placeholder="Economics"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            maxLength={80}
            className="input"
          />
        </Field>
      </div>

      <Field label="Campus region" htmlFor="region">
        <select
          id="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="input"
        >
          <option value="">Not set</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/profile')}
          disabled={saving}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-light disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
