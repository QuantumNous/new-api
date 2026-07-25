// A small set of clean, single-weight line icons (SF-Symbols-ish): 24px grid, 1.7 stroke,
// currentColor, rounded caps/joins. Replaces emoji in the chrome for a crisp, consistent look.

export type IconName =
  | "sparkle"
  | "logo"
  | "sidebar"
  | "sidebarRight"
  | "signOut"
  | "chat"
  | "diamond"
  | "search"
  | "folder"
  | "folderPlus"
  | "plus"
  | "clock"
  | "sliders"
  | "gear"
  | "inbox"
  | "code"
  | "wrench"
  | "pencil"
  | "branch"
  | "arrowLeft"
  | "copy"
  | "refresh"
  | "panelClose"
  | "panelOpen"
  | "plug"
  | "audit"
  | "chevronRight"
  | "chevronDown"
  | "moreHorizontal"
  | "pin"
  | "archive"
  | "trash"
  | "shield"
  | "file"
  | "fileCode"
  | "image"
  | "table"
  | "mic"
  | "stop"
  | "x";

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const s = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "sparkle":
      // Filled 4-point twinkle — crisp at small sizes.
      return (
        <svg {...s} fill="currentColor" stroke="none">
          <path d="M12 2.4c.5 4.7 2.5 6.7 7.2 7.2-4.7.5-6.7 2.5-7.2 7.2-.5-4.7-2.5-6.7-7.2-7.2 4.7-.5 6.7-2.5 7.2-7.2z" />
        </svg>
      );
    case "logo":
      // The OpenWorker mark — a 6-point star, matching the app + macOS tray icon.
      return (
        <svg {...s} fill="currentColor" stroke="none">
          <path d="M12.00 1.80 L13.35 9.66 L20.83 6.90 L14.70 12.00 L20.83 17.10 L13.35 14.34 L12.00 22.20 L10.65 14.34 L3.17 17.10 L9.30 12.00 L3.17 6.90 L10.65 9.66 Z" />
        </svg>
      );
    case "sidebar":
      // Clean "sidebar panel" toggle — rounded rect + divider, no chevron (one glyph both states).
      return (
        <svg {...s}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="4" />
          <path d="M9 4.5v15" />
        </svg>
      );
    case "sidebarRight":
      // Right-panel counterpart of "sidebar" — same rounded rect + divider, mirrored.
      return (
        <svg {...s}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="4" />
          <path d="M15 4.5v15" />
        </svg>
      );
    case "signOut":
      return (
        <svg {...s}>
          <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
          <path d="M15 8l4 4-4 4M19 12H9" />
        </svg>
      );
    case "folder":
      // Clean single-tab folder (Lucide-style) — no internal divider line.
      return (
        <svg {...s}>
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.81-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...s}>
          <path d="M12 3.2l7 2.8v5.1c0 4.3-2.9 7.4-7 9.7-4.1-2.3-7-5.4-7-9.7V6l7-2.8z" />
          <path d="M9.3 12.1l1.9 1.9 3.5-3.6" />
        </svg>
      );
    case "file":
      // Document with a folded corner + text lines.
      return (
        <svg {...s}>
          <path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
          <path d="M13.5 3.5V8H18M8.5 12.5h7M8.5 16h5" />
        </svg>
      );
    case "fileCode":
      // Document with </> marks (html/code).
      return (
        <svg {...s}>
          <path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
          <path d="M13.5 3.5V8H18M10.2 12l-2 2.2 2 2.2M13.3 12l2 2.2-2 2.2" />
        </svg>
      );
    case "image":
      // Picture frame: sun + mountains.
      return (
        <svg {...s}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M4.5 16.5l4.5-4 3.5 3 3-2.5 4 3.5" />
        </svg>
      );
    case "table":
      // Spreadsheet grid (csv/xlsx).
      return (
        <svg {...s}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M4 10h16M10 10v9M4 14.5h16" />
        </svg>
      );
    case "mic":
      return (
        <svg {...s}>
          <rect x="8.5" y="3.5" width="7" height="11" rx="3.5" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
        </svg>
      );
    case "stop":
      return (
        <svg {...s} fill="currentColor" stroke="none">
          <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
        </svg>
      );
    case "x":
      return (
        <svg {...s}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "folderPlus":
      // Same clean folder body + a centered plus (Lucide-style).
      return (
        <svg {...s}>
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.81-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h8.5" />
          <path d="M19 14v6M16 17h6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...s}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      );
    case "clock":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="8.3" />
          <path d="M12 7.8V12l2.8 1.7" />
        </svg>
      );
    case "sliders":
      // Two rails, knob on each, rails broken around the knobs (owner pick 2026-07-11:
      // the three-rail version read as heavier than the mocks' two-rail glyph).
      return (
        <svg {...s}>
          <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
          <circle cx="16" cy="8" r="2" />
          <circle cx="8" cy="16" r="2" />
        </svg>
      );
    case "gear":
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.3 1a7 7 0 00-1.7-1L16.5 3h-4l-.4 2.4a7 7 0 00-1.7 1l-2.3-1-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.4h4l.4-2.4a7 7 0 001.7-1l2.3 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z" />
        </svg>
      );
    case "inbox":
      return (
        <svg {...s}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z" />
        </svg>
      );
    case "code":
      return (
        <svg {...s}>
          <path d="M8.5 8.5 4.5 12l4 3.5M15.5 8.5l4 3.5-4 3.5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...s}>
          <path d="M5 5.5h14c.8 0 1.5.7 1.5 1.5v7c0 .8-.7 1.5-1.5 1.5H9.5L5.5 19v-3H5c-.8 0-1.5-.7-1.5-1.5V7c0-.8.7-1.5 1.5-1.5z" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...s}>
          <path d="M14.6 6.4a3.8 3.8 0 0 0-5 4.9l-6 6a1.6 1.6 0 0 0 2.3 2.3l6-6a3.8 3.8 0 0 0 4.9-5l-2.4 2.4-2-.5-.5-2 2.7-2.1z" />
        </svg>
      );
    case "search":
      return (
        <svg {...s}>
          <circle cx="10.5" cy="10.5" r="6.3" />
          <path d="M15.2 15.2 20 20" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...s} fill="currentColor" stroke="none">
          <path d="M12 3.2 20.8 12 12 20.8 3.2 12z" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...s}>
          <path d="M4 20l1.1-3.9L15.6 5.6a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3L7.9 18.9 4 20z" />
          <path d="M14.5 6.7l2.8 2.8" />
        </svg>
      );
    case "branch":
      return (
        <svg {...s}>
          <circle cx="7" cy="6" r="2.1" />
          <circle cx="7" cy="18" r="2.1" />
          <circle cx="17" cy="8" r="2.1" />
          <path d="M7 8.1v7.8M7 12.5c5.4 0 10-.4 10-2.4" />
        </svg>
      );
    case "arrowLeft":
      return (
        <svg {...s}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );
    case "copy":
      return (
        <svg {...s}>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M5 15.5H4.8A1.8 1.8 0 0 1 3 13.7V4.8A1.8 1.8 0 0 1 4.8 3h8.9a1.8 1.8 0 0 1 1.8 1.8V5" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...s}>
          <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M16 16h4v4" />
        </svg>
      );
    case "panelClose":
      return (
        <svg {...s}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M14.5 5v14M8 10l3 2-3 2" />
        </svg>
      );
    case "panelOpen":
      return (
        <svg {...s}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M9.5 5v14M16 10l-3 2 3 2" />
        </svg>
      );
    case "plug":
      return (
        <svg {...s}>
          <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5" />
        </svg>
      );
    case "audit":
      return (
        <svg {...s}>
          <path d="M7 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M8.5 9h7M8.5 13h7M8.5 17H13" />
        </svg>
      );
    case "chevronRight":
      return (
        <svg {...s}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "chevronDown":
      return (
        <svg {...s}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "moreHorizontal":
      return (
        <svg {...s}>
          <circle cx="6.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pin":
      return (
        <svg {...s}>
          <path d="M14.2 4.8 19.2 9.8M9.2 14.4 4.7 18.9M8 8.6l7.4 7.4M8.4 8.2l2.3-3.4 8.5 8.5-3.4 2.3c-.7.5-1.6.4-2.2-.2L8.6 10.4c-.6-.6-.7-1.5-.2-2.2z" />
        </svg>
      );
    case "archive":
      return (
        <svg {...s}>
          <path d="M4.5 7.5h15M6 7.5v10.2c0 1 .8 1.8 1.8 1.8h8.4c1 0 1.8-.8 1.8-1.8V7.5M5.6 4.5h12.8c.6 0 1.1.5 1.1 1.1v1.9h-15V5.6c0-.6.5-1.1 1.1-1.1z" />
          <path d="M9.5 11.5h5" />
        </svg>
      );
    case "trash":
      return (
        <svg {...s}>
          <path d="M4.5 7h15" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6.5 7l.9 12c.1.9.8 1.5 1.7 1.5h7.8c.9 0 1.6-.6 1.7-1.5l.9-12" />
          <path d="M9.2 7V4.9c0-.5.4-.9.9-.9h3.8c.5 0 .9.4.9.9V7" />
        </svg>
      );
  }
}
