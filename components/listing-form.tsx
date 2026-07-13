'use client';

// Shared Create / Update Listing form (PRD §6.4, §6.5). Identical fields and
// validation in both modes; edit mode diffs against the loaded listing and
// submits only what changed.
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createListing, updateListing } from '@/app/listings/actions';
import { uploadListingImage } from '@/lib/image-upload';
import type { Category, Condition, Listing } from '@/lib/types';

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'books', label: 'Books' },
  { value: 'other', label: 'Other' },
];

const REGIONS = ['Southside', 'Northside', 'Downtown', 'Westbrae', 'Other'];

const MAX_PHOTOS = 10;

// One photo slot: an already-uploaded image (edit mode) or a new local file.
type PhotoItem = { key: string; url: string; file?: File };

type FormErrors = Partial<
  Record<'photos' | 'title' | 'description' | 'price' | 'condition' | 'category' | 'region' | 'submit', string>
>;

export function ListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const isEdit = !!listing;

  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (listing?.listing_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({ key: img.id, url: img.image_url })),
  );
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [price, setPrice] = useState(
    listing ? (listing.price_cents / 100).toString() : '',
  );
  const [condition, setCondition] = useState<Condition | ''>(listing?.condition ?? '');
  const [category, setCategory] = useState<Category | ''>(listing?.category ?? '');
  const [region, setRegion] = useState(listing?.region_id ?? '');

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setPhotos((prev) =>
      [
        ...prev,
        ...incoming.map((file) => ({
          key: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          file,
        })),
      ].slice(0, MAX_PHOTOS),
    );
    setErrors((e) => ({ ...e, photos: undefined }));
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const item = prev.find((p) => p.key === key);
      if (item?.file) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.key !== key);
    });
  }

  function movePhoto(key: string, dir: -1 | 1) {
    setPhotos((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (photos.length < 1) errs.photos = 'Add at least one photo.';
    if (!title.trim()) errs.title = 'Title is required.';
    if (!description.trim()) errs.description = 'Description is required.';
    const priceNum = Number.parseFloat(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) {
      errs.price = 'Enter a price greater than 0.';
    }
    if (!condition) errs.condition = 'Pick a condition.';
    if (!category) errs.category = 'Pick a category.';
    if (!region) errs.region = 'Pick a location.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const listingId = listing?.id ?? crypto.randomUUID();

      // Upload any new files, preserving slot order.
      const imageUrls = await Promise.all(
        photos.map((p) => (p.file ? uploadListingImage(listingId, p.file) : p.url)),
      );

      const price_cents = Math.round(Number.parseFloat(price) * 100);
      const fields = {
        title: title.trim(),
        description: description.trim(),
        price_cents,
        condition: condition as Condition,
        category: category as Category,
        region_id: region,
      };

      let result;
      if (!isEdit) {
        result = await createListing({ id: listingId, ...fields, images: imageUrls });
      } else {
        // Change tracking (PRD §6.5): send only fields that differ.
        const changed: Partial<typeof fields> = {};
        if (fields.title !== listing.title) changed.title = fields.title;
        if (fields.description !== listing.description) changed.description = fields.description;
        if (fields.price_cents !== listing.price_cents) changed.price_cents = fields.price_cents;
        if (fields.condition !== listing.condition) changed.condition = fields.condition;
        if (fields.category !== listing.category) changed.category = fields.category;
        if (fields.region_id !== (listing.region_id ?? '')) changed.region_id = fields.region_id;

        const originalUrls = (listing.listing_images ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((i) => i.image_url);
        const imagesChanged =
          imageUrls.length !== originalUrls.length ||
          imageUrls.some((url, i) => url !== originalUrls[i]);

        result = await updateListing({
          id: listingId,
          fields: changed,
          ...(imagesChanged ? { images: imageUrls } : {}),
        });
      }

      if (result.error) {
        setErrors({ submit: result.error });
        setSubmitting(false);
        return;
      }
      router.push(isEdit ? '/profile/listings' : '/campus');
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Something went wrong.' });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pb-10">
      {/* Photos (PRD §6.4: hero dropzone) */}
      <section>
        <FieldLabel>Photos ({photos.length}/{MAX_PHOTOS})</FieldLabel>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
            dragOver ? 'border-brand bg-purple-50' : 'border-gray-300'
          }`}
        >
          {photos.length > 0 && (
            <ul className="mb-3 grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <li key={p.key} className="relative">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                    {/* Local previews are blob: URLs — next/image can't optimize those */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Cover
                    </span>
                  )}
                  <div className="mt-1 flex justify-center gap-1">
                    <PhotoButton label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => movePhoto(p.key, -1)}>←</PhotoButton>
                    <PhotoButton label={`Remove photo ${i + 1}`} onClick={() => removePhoto(p.key)}>✕</PhotoButton>
                    <PhotoButton label={`Move photo ${i + 1} later`} disabled={i === photos.length - 1} onClick={() => movePhoto(p.key, 1)}>→</PhotoButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1 rounded-lg py-6 text-sm text-muted hover:bg-gray-50"
            >
              <span className="text-2xl" aria-hidden>📷</span>
              Tap to add photos, or drag &amp; drop
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <FieldError message={errors.photos} />
      </section>

      <section>
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="IKEA desk — great condition"
          className="input"
        />
        <FieldError message={errors.title} />
      </section>

      <section>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Condition details, dimensions, pickup spot…"
          className="input resize-y"
        />
        <FieldError message={errors.description} />
      </section>

      <section>
        <FieldLabel htmlFor="price">Price ($)</FieldLabel>
        <input
          id="price"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="45"
          className="input"
        />
        <FieldError message={errors.price} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section>
          <FieldLabel htmlFor="condition">Condition</FieldLabel>
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className="input"
          >
            <option value="" disabled>Select…</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <FieldError message={errors.condition} />
        </section>

        <section>
          <FieldLabel htmlFor="category">Category</FieldLabel>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="input"
          >
            <option value="" disabled>Select…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <FieldError message={errors.category} />
        </section>
      </div>

      <section>
        <FieldLabel htmlFor="region">Location</FieldLabel>
        <select
          id="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="input"
        >
          <option value="" disabled>Where can buyers pick up?</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <FieldError message={errors.region} />
      </section>

      {errors.submit && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errors.submit}
        </p>
      )}

      <div className="flex gap-3">
        {isEdit && (
          <button
            type="button"
            onClick={() => router.push('/profile/listings')}
            disabled={submitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-foreground hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-light disabled:opacity-60"
        >
          {submitting
            ? isEdit ? 'Saving…' : 'Publishing…'
            : isEdit ? 'Update' : 'Publish'}
        </button>
      </div>
    </form>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mt-1 text-sm text-red-600">{message}</p>;
}

function PhotoButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-foreground hover:bg-gray-200 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
