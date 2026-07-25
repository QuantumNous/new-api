// Default hero art for gallery personas. Publishers will eventually attach real
// imagery; until then (and whenever they don't) every persona gets a deterministic
// abstract "agent" mark — hue derived from the slug, so a persona always looks the
// same everywhere but no two look alike. Rendered as an image, so it deliberately
// keeps its own colors in dark mode (like a photo would).

function hueOf(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 3600;
  return h % 360;
}

export function PersonaHero({
  slug,
  height = 120,
  className = "",
}: {
  slug: string;
  height?: number;
  className?: string;
}) {
  const h = hueOf(slug);
  const bg = `hsl(${h} 42% 91%)`;
  const deep = `hsl(${h} 45% 42%)`;
  const mid = `hsl(${h} 45% 62%)`;
  const alt = `hsl(${(h + 45) % 360} 50% 60%)`;
  return (
    <svg
      className={className}
      style={{ width: "100%", height, display: "block" }}
      viewBox="0 0 400 120"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${slug} artwork`}
    >
      <rect width="400" height="120" rx="12" fill={bg} />
      {/* orbit rings around a central agent spark, with satellite nodes */}
      <circle cx="200" cy="60" r="34" fill="none" stroke={mid} strokeWidth="1.5" opacity="0.55" />
      <circle cx="200" cy="60" r="52" fill="none" stroke={mid} strokeWidth="1" opacity="0.3" />
      <circle cx="166" cy="60" r="4" fill={alt} />
      <circle cx="237" cy="93" r="3" fill={mid} />
      <circle cx="252" cy="60" r="2.5" fill={mid} opacity="0.7" />
      <circle cx="163" cy="24" r="2.5" fill={alt} opacity="0.7" />
      {/* ambient dots drifting out to the edges */}
      <circle cx="60" cy="30" r="2" fill={mid} opacity="0.45" />
      <circle cx="88" cy="88" r="3" fill={alt} opacity="0.35" />
      <circle cx="330" cy="34" r="3" fill={mid} opacity="0.4" />
      <circle cx="352" cy="86" r="2" fill={alt} opacity="0.45" />
      {/* the agent spark: a four-point star on a soft badge */}
      <circle cx="200" cy="60" r="19" fill="#fff" opacity="0.9" />
      <path
        d="M200 46c1.8 7.2 4.8 10.2 12 12-7.2 1.8-10.2 4.8-12 12-1.8-7.2-4.8-10.2-12-12 7.2-1.8 10.2-4.8 12-12z"
        fill={deep}
      />
    </svg>
  );
}
