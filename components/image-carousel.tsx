'use client';

// Listing photo carousel with pagination dots (PRD §6.3). Native scroll-snap
// does the swiping — no carousel library needed. Falls back to a placeholder
// slide when a listing has no images.
import Image from 'next/image';
import { useRef, useState } from 'react';

export function ImageCarousel({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-5xl" aria-label="No photos">
        📦
      </div>
    );
  }

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  function scrollTo(index: number) {
    const el = trackRef.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
      >
        {images.map((url, i) => (
          <div
            key={url}
            className="relative w-full shrink-0 snap-center bg-gray-100"
            aria-label={`Photo ${i + 1} of ${images.length}`}
          >
            <Image
              src={url}
              alt={`${title} — photo ${i + 1}`}
              fill
              sizes="448px"
              className="object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === active}
              onClick={() => scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === active ? 'w-4 bg-white' : 'w-2 bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
