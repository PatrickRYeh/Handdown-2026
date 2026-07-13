import Image from 'next/image';

// Avatar with colored-initials fallback (PRD §7.2).
export function Avatar({
  name,
  url,
  size = 48,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <span
        className="relative inline-block shrink-0 overflow-hidden rounded-full bg-gray-100"
        style={{ width: size, height: size }}
      >
        <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }

  const initial = (name || '?').charAt(0).toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: `hsl(${hue} 55% 55%)`,
      }}
    >
      {initial}
    </span>
  );
}
