// Connector brand marks, hand-drawn as tiny inline SVGs (no external assets, works
// offline). Deliberately simplified geometry — recognizable at 14–20px, not exact
// reproductions. Brand colors are hardcoded (they don't theme); the Notion and GitHub
// tiles use currentColor so they stay legible in dark mode. Unknown connectors fall
// back to the neutral plug glyph so new descriptors degrade gracefully.

import { Icon } from "./Icon";

const ALIAS: Record<string, string> = {
  gcal: "google_calendar",
  gdrive: "google_drive",
  msteams: "teams",
};

function Gmail({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#fff" stroke="#d8dce1" strokeWidth="0.75" />
      <path d="M2 7.5v9.7c0 1 .8 1.8 1.8 1.8H5V9.9L2.6 6.2C2.2 6.5 2 7 2 7.5z" fill="#4285F4" />
      <path d="M22 7.5v9.7c0 1-.8 1.8-1.8 1.8H19V9.9l2.4-3.7c.4.3.6.8.6 1.3z" fill="#34A853" />
      <path d="M5 9.9 2.6 6.2c.3-.7 1-1.2 1.9-1.2.4 0 .9.2 1.2.4L12 10.6l6.3-5.2c.3-.2.8-.4 1.2-.4.9 0 1.6.5 1.9 1.2L19 9.9l-7 5.4z" fill="#EA4335" />
    </svg>
  );
}

function GoogleCalendar({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#4285F4" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="1" fill="#fff" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="8.4" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#4285F4">31</text>
    </svg>
  );
}

function GoogleDrive({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.6 3.5h6.8L22 15.2h-6.8z" fill="#FBBC04" />
      <path d="M8.6 3.5 2 15.2l3.4 5.3 6.6-11.7z" fill="#34A853" />
      <path d="M22 15.2H8.4l-3 5.3h13.2z" fill="#4285F4" />
    </svg>
  );
}

function Slack({ s }: { s: number }) {
  // The lattice, reduced to its four comma-shapes (pill + dot per color).
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9.5" y="2.5" width="4" height="9" rx="2" fill="#36C5F0" transform="rotate(0 11.5 7)" />
      <circle cx="6.5" cy="9" r="2" fill="#36C5F0" />
      <rect x="12.5" y="9.5" width="9" height="4" rx="2" fill="#2EB67D" />
      <circle cx="15" cy="6.5" r="2" fill="#2EB67D" />
      <rect x="10.5" y="12.5" width="4" height="9" rx="2" fill="#ECB22E" />
      <circle cx="17.5" cy="15" r="2" fill="#ECB22E" />
      <rect x="2.5" y="10.5" width="9" height="4" rx="2" fill="#E01E5A" />
      <circle cx="9" cy="17.5" r="2" fill="#E01E5A" />
    </svg>
  );
}

function Notion({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="1" />
      <path d="M8 17V7.5l1.8-.3 5 7.6V7h1.7v9.6l-2 .4-4.8-7.3V17z" fill="var(--ink)" />
    </svg>
  );
}

function HubSpot({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="14.5" cy="13.5" r="5" fill="none" stroke="#FF7A59" strokeWidth="2.6" />
      <path d="M14.5 8.5V4.5M14.5 4.5h.01M6 5l5.2 5.2M7.5 19.5l3.6-3.6" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="5.5" cy="4.5" r="1.7" fill="#FF7A59" />
      <circle cx="6.5" cy="20.5" r="1.7" fill="#FF7A59" />
    </svg>
  );
}

function Outlook({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="4" width="13" height="16" rx="1.5" fill="#50A9E8" />
      <rect x="9" y="4" width="13" height="8" rx="1.5" fill="#7CC1F0" />
      <rect x="2" y="6" width="12" height="12" rx="2" fill="#0F6CBD" />
      <ellipse cx="8" cy="12" rx="3.2" ry="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

function PagerDuty({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#06AC38" />
      <path d="M8.5 18.5v-3M8.5 13.5V6.2c1-.5 2.3-.7 3.6-.7 2.9 0 4.9 1.5 4.9 4s-2 4-5 4z" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GitHub({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2C6.5 2 2 6.6 2 12.3c0 4.6 2.9 8.4 6.8 9.8.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.3-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5.1 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 4-2.4 4.8-4.6 5.1.4.3.7 1 .7 1.9v2.9c0 .3.2.6.7.5a10.2 10.2 0 0 0 6.8-9.8C22 6.6 17.5 2 12 2z"
        fill="var(--ink)"
      />
    </svg>
  );
}

function Telegram({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#2AABEE" />
      <path d="m5.5 11.9 11.3-4.4c.5-.2 1 .1.8.9l-1.9 9.1c-.1.6-.5.8-1.1.5l-2.9-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3 5.5-5c.2-.2 0-.3-.3-.1l-6.8 4.3-2.9-.9c-.6-.2-.6-.7.1-.9z" fill="#fff" />
    </svg>
  );
}

const MARKS: Record<string, (p: { s: number }) => JSX.Element> = {
  gmail: Gmail,
  google_calendar: GoogleCalendar,
  google_drive: GoogleDrive,
  slack: Slack,
  notion: Notion,
  hubspot: HubSpot,
  outlook: Outlook,
  teams: Outlook,
  pagerduty: PagerDuty,
  github: GitHub,
  telegram: Telegram,
};

export function hasBrandIcon(name: string): boolean {
  return (ALIAS[name] || name) in MARKS;
}

/** A connector's brand mark; unrecognized connectors get the neutral plug glyph. */
export function BrandIcon({ name, size = 15 }: { name: string; size?: number }) {
  const Mark = MARKS[ALIAS[name] || name];
  if (!Mark) return <Icon name="plug" size={size} />;
  return <Mark s={size} />;
}
