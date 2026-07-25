// Connector logo registry — maps a stable `logo` id (from a connector's API descriptor) to the
// brand's real monochrome mark, plus a human label. The brand color is deliberately NOT stored
// here: it comes from the API (`brand_color`) so the descriptor stays the single source of truth.
// Unknown / empty ids resolve to FALLBACK (a neutral plug glyph).
//
// Most marks come from the `simple-icons` package: official 24x24 single-path monochrome brand
// glyphs that paint with `currentColor`, so ConnectorIcon / ConnectorBadge tint them with the
// connector's brand color. Slack, Salesforce, Outlook, and Canva are no longer distributed by
// the package (removed at the trademark holders' request), so their path data is vendored below in
// the same format. Brands with no published monochrome mark (Attio, Apollo.io, Hunter,
// Amplitude, Descript, Clay, Close, Docusign — whose current post-rebrand mark no icon pack
// ships) and the non-brand utilities (email, browser, MCP, fallback plug) keep simple custom
// glyphs. (Filename is `.tsx` because the entries are JSX — the spec's `registry.ts` can't hold
// JSX.)

import type { SimpleIcon } from "simple-icons";
import {
  siAsana,
  siBox,
  siClickup,
  siConfluence,
  siDatadog,
  siDiscord,
  siDropbox,
  siFigma,
  siGithub,
  siGitlab,
  siGmail,
  siGooglecalendar,
  siGoogledrive,
  siHubspot,
  siJira,
  siLinear,
  siMixpanel,
  siNotion,
  siPagerduty,
  siPosthog,
  siQuickbooks,
  siStripe,
  siTelegram,
  siWhatsapp,
  siZendesk,
} from "simple-icons";

// `JSX` is global with the react-jsx runtime + @types/react.
type LogoComponent = () => JSX.Element;

export interface ConnectorRegistryEntry {
  label: string;
  logo: LogoComponent;
}

/** 24x24 single-path brand mark (simple-icons path format) painting with `currentColor`. */
function pathLogo(d: string): LogoComponent {
  return () => (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function brand(icon: SimpleIcon): ConnectorRegistryEntry {
  return { label: icon.title, logo: pathLogo(icon.path) };
}

// Path data vendored from simple-icons v9 (CC0) — these brands were later removed from the
// package and can't be imported from v16.
const SLACK_PATH =
  "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z";

const SALESFORCE_PATH =
  "M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8";

const CANVA_PATH =
  "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM6.962 7.68c.754 0 1.337.549 1.405 1.2.069.583-.171 1.097-.822 1.406-.343.171-.48.172-.549.069-.034-.069 0-.137.069-.206.617-.514.617-.926.548-1.508-.034-.378-.308-.618-.583-.618-1.2 0-2.914 2.674-2.674 4.629.103.754.549 1.646 1.509 1.646.308 0 .65-.103.96-.24.5-.264.799-.47 1.097-.8-.073-.885.704-2.046 1.851-2.046.515 0 .926.205.96.583.068.514-.377.582-.514.582s-.378-.034-.378-.17c-.034-.138.309-.07.275-.378-.035-.206-.24-.274-.446-.274-.72 0-1.131.994-1.029 1.611.035.275.172.549.447.549.205 0 .514-.31.617-.755.068-.308.343-.514.583-.514.102 0 .17.034.205.171v.138c-.034.137-.137.548-.102.651 0 .069.034.171.17.171.092 0 .436-.18.777-.459.117-.59.253-1.298.253-1.357.034-.24.137-.48.617-.48.103 0 .171.034.205.171v.138l-.136.617c.445-.583 1.097-.994 1.508-.994.172 0 .309.102.309.274 0 .103 0 .274-.069.446-.137.377-.309.96-.412 1.474 0 .137.035.274.207.274.171 0 .685-.206 1.096-.754l.007-.004c-.002-.068-.007-.134-.007-.202 0-.411.035-.754.104-.994.068-.274.411-.514.617-.514.103 0 .205.069.205.171 0 .035 0 .103-.034.137-.137.446-.24.857-.24 1.269 0 .24.034.582.102.788 0 .034.035.069.07.069.068 0 .548-.445.89-1.028-.308-.206-.48-.549-.48-.96 0-.72.446-1.097.858-1.097.343 0 .617.24.617.72 0 .308-.103.65-.274.96h.102a.77.77 0 0 0 .584-.24.293.293 0 0 1 .134-.117c.335-.425.83-.74 1.41-.74.48 0 .924.205.959.582.068.515-.378.618-.515.618l-.002-.002c-.138 0-.377-.035-.377-.172 0-.137.309-.068.274-.376-.034-.206-.24-.275-.446-.275-.686 0-1.13.891-1.028 1.611.034.275.171.583.445.583.206 0 .515-.308.652-.754.068-.274.343-.514.583-.514.103 0 .17.034.205.171 0 .069 0 .206-.137.652-.17.308-.171.48-.137.617.034.274.171.48.309.583.034.034.068.102.068.102 0 .069-.034.138-.137.138-.034 0-.068 0-.103-.035-.514-.205-.72-.548-.789-.891-.205.24-.445.377-.72.377-.445 0-.89-.411-.96-.926a1.609 1.609 0 0 1 .075-.649c-.203.13-.422.203-.623.203h-.17c-.447.652-.927 1.098-1.27 1.303a.896.896 0 0 1-.377.104c-.068 0-.171-.035-.205-.104-.095-.152-.156-.392-.193-.667-.481.527-1.145.805-1.453.805-.343 0-.548-.206-.582-.55v-.376c.102-.754.377-1.2.377-1.337a.074.074 0 0 0-.069-.07c-.24 0-1.028.824-1.166 1.373l-.103.445c-.068.309-.377.515-.582.515-.103 0-.172-.035-.206-.172v-.137l.046-.233c-.435.31-.87.508-1.075.508-.308 0-.48-.172-.514-.412-.206.274-.445.412-.754.412-.352 0-.696-.24-.862-.593-.244.275-.523.553-.852.764-.48.309-1.028.549-1.68.549-.582 0-1.097-.309-1.371-.583-.412-.377-.651-.96-.686-1.509-.205-1.68.823-3.84 2.4-4.8.378-.205.755-.343 1.132-.343zm9.77 3.291c-.104 0-.172.172-.172.343 0 .274.137.583.309.755a1.74 1.74 0 0 0 .102-.583c0-.343-.137-.515-.24-.515z";

const OUTLOOK_PATH =
  "M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z";

/** Shared shell for the custom stroke glyphs (utilities + brands with no published mono mark). */
function strokeLogo(children: JSX.Element): LogoComponent {
  return () => (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const EmailLogo = strokeLogo(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 7.5 12 13.5l8.5-6" />
  </>,
);

const BrowserLogo = strokeLogo(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18" />
  </>,
);

const McpLogo = strokeLogo(
  <>
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="5" cy="6" r="1.8" />
    <circle cx="19" cy="6" r="1.8" />
    <circle cx="12" cy="20" r="1.8" />
    <path d="M10.3 10.6 6.4 7.3M13.7 10.6l3.9-3.3M12 14.2V18.2" />
  </>,
);

const AttioLogo = strokeLogo(
  <>
    <path d="M4.5 19.5 12 4.5l7.5 15M7.6 13.4h8.8" />
  </>,
);

// monday.com's mark is three staggered capsule bars; no simple-icons mono mark exists.
const MondayLogo = strokeLogo(
  <>
    <path d="M4.5 7.5h9M4.5 12h15M4.5 16.5h6.5" />
  </>,
);

const AmplitudeLogo = strokeLogo(
  <>
    <path d="M2.5 13.5h4l3-8 4.5 13 3-8h4.5" />
  </>,
);

const ApolloLogo = strokeLogo(
  <>
    <circle cx="10" cy="14" r="6" />
    <path d="M14.5 9.5 21 3M16.5 3H21v4.5" />
  </>,
);

const DescriptLogo = strokeLogo(
  <>
    <path d="M4 5.5h16M4 10h11M4 14.5h14M4 19h8" />
  </>,
);

const ClayLogo = strokeLogo(
  <>
    <path d="M3 19a9 9 0 0 1 18 0zM1.5 19h21" />
  </>,
);

const CloseLogo = strokeLogo(
  <>
    <ellipse cx="12" cy="12" rx="9" ry="3.8" />
    <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
    <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
  </>,
);

const DocusignLogo = strokeLogo(
  <>
    <path d="M14.5 5.5 18.5 9.5 8 20H4v-4L14.5 5.5zM12.5 7.5l4 4" />
    <path d="M4 21.5h16" />
  </>,
);

const HunterLogo = strokeLogo(
  <>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </>,
);

const PlugLogo = strokeLogo(
  <>
    <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5" />
  </>,
);

/** Neutral fallback for unknown / empty logo ids. */
export const FALLBACK: ConnectorRegistryEntry = { label: "Connector", logo: PlugLogo };

export const CONNECTORS: Record<string, ConnectorRegistryEntry> = {
  // Real brand marks from simple-icons.
  asana: brand(siAsana),
  box: brand(siBox),
  clickup: brand(siClickup),
  confluence: brand(siConfluence),
  datadog: brand(siDatadog),
  discord: brand(siDiscord),
  dropbox: brand(siDropbox),
  figma: brand(siFigma),
  github: brand(siGithub),
  gitlab: brand(siGitlab),
  gmail: brand(siGmail),
  google_calendar: brand(siGooglecalendar),
  google_drive: brand(siGoogledrive),
  hubspot: brand(siHubspot),
  jira: brand(siJira),
  linear: brand(siLinear),
  mixpanel: brand(siMixpanel),
  notion: brand(siNotion),
  pagerduty: brand(siPagerduty),
  posthog: brand(siPosthog),
  quickbooks: brand(siQuickbooks),
  stripe: brand(siStripe),
  telegram: brand(siTelegram),
  whatsapp: brand(siWhatsapp),
  zendesk: brand(siZendesk),
  // Real brand marks vendored from simple-icons v9.
  slack: { label: "Slack", logo: pathLogo(SLACK_PATH) },
  salesforce: { label: "Salesforce", logo: pathLogo(SALESFORCE_PATH) },
  outlook: { label: "Outlook", logo: pathLogo(OUTLOOK_PATH) },
  canva: { label: "Canva", logo: pathLogo(CANVA_PATH) },
  // No published monochrome mark — custom glyphs, tinted with the real brand color.
  attio: { label: "Attio", logo: AttioLogo },
  monday: { label: "monday.com", logo: MondayLogo },
  descript: { label: "Descript", logo: DescriptLogo },
  clay: { label: "Clay", logo: ClayLogo },
  close: { label: "Close", logo: CloseLogo },
  docusign: { label: "Docusign", logo: DocusignLogo },
  amplitude: { label: "Amplitude", logo: AmplitudeLogo },
  apollo: { label: "Apollo.io", logo: ApolloLogo },
  hunter: { label: "Hunter", logo: HunterLogo },
  // Non-brand utilities.
  email: { label: "Email", logo: EmailLogo },
  browser: { label: "Browser", logo: BrowserLogo },
  mcp: { label: "MCP", logo: McpLogo },
};

/**
 * Resolve a logo id to its registry entry plus the matched key. Unknown / empty ids return the
 * FALLBACK entry with key `"fallback"` (so callers and tests can distinguish a hit from a miss).
 */
export function resolveConnector(logo?: string): { key: string; entry: ConnectorRegistryEntry } {
  const id = (logo ?? "").trim();
  if (id && Object.prototype.hasOwnProperty.call(CONNECTORS, id)) {
    return { key: id, entry: CONNECTORS[id] };
  }
  return { key: "fallback", entry: FALLBACK };
}
