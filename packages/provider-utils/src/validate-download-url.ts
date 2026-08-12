import { DownloadError } from './download-error';

/**
 * Validates that a URL is safe to download from, blocking private/internal addresses
 * to prevent SSRF attacks.
 *
 * Note: this performs string/literal-IP checks only. It does not resolve DNS, so a
 * hostname that resolves to a private address is not blocked here (see callers, which
 * should additionally constrain egress at the network layer when handling untrusted URLs).
 *
 * @param url - The URL string to validate.
 * @throws DownloadError if the URL is unsafe.
 */
export function validateDownloadUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DownloadError({
      url,
      message: `Invalid URL: ${url}`,
    });
  }

  // data: URLs are inline content, so they do not trigger a network fetch or SSRF risk.
  if (parsed.protocol === 'data:') {
    return;
  }

  // Only allow http and https network protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new DownloadError({
      url,
      message: `URL scheme must be http, https, or data, got ${parsed.protocol}`,
    });
  }

  // Strip a trailing dot so a fully-qualified name like `localhost.` (which resolves
  // identically to `localhost`) cannot bypass the hostname blocklist below.
  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');

  // Block empty hostname
  if (!hostname) {
    throw new DownloadError({
      url,
      message: `URL must have a hostname`,
    });
  }

  // Block localhost and .local domains
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  ) {
    throw new DownloadError({
      url,
      message: `URL with hostname ${hostname} is not allowed`,
    });
  }

  // Check for IPv6 addresses (enclosed in brackets in URLs)
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ipv6 = hostname.slice(1, -1);
    if (isPrivateIPv6(ipv6)) {
      throw new DownloadError({
        url,
        message: `URL with IPv6 address ${hostname} is not allowed`,
      });
    }
    return;
  }

  // Check for IPv4 addresses
  if (isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      throw new DownloadError({
        url,
        message: `URL with IP address ${hostname} is not allowed`,
      });
    }
    return;
  }
}

function isIPv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const num = Number(part);
    return (
      Number.isInteger(num) && num >= 0 && num <= 255 && String(num) === part
    );
  });
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const [a, b, c] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 (CGNAT, used by some cloud providers for internal traffic)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 169.254.0.0/16
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 240.0.0.0/4 (reserved, includes 255.255.255.255 broadcast)
  if (a >= 240) return true;

  return false;
}

/**
 * Expands an IPv6 address string into its 8 16-bit groups, handling `::`
 * compression and an optional dotted-decimal IPv4 tail (e.g. `::ffff:127.0.0.1`).
 *
 * @returns the 8 groups, or null if the input is not a parseable IPv6 address.
 */
function parseIPv6(ip: string): number[] | null {
  // Strip an optional zone id (e.g. `fe80::1%eth0`).
  let address = ip.toLowerCase();
  const zoneIndex = address.indexOf('%');
  if (zoneIndex !== -1) {
    address = address.slice(0, zoneIndex);
  }

  // At most one `::` compression marker is allowed.
  const halves = address.split('::');
  if (halves.length > 2) return null;

  const toGroups = (segment: string): number[] | null => {
    if (segment === '') return [];
    const groups: number[] = [];
    const parts = segment.split(':');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      // A dotted-decimal IPv4 tail is only valid as the final part.
      if (part.includes('.')) {
        if (i !== parts.length - 1 || !isIPv4(part)) return null;
        const [a, b, c, d] = part.split('.').map(Number);
        groups.push((a << 8) | b, (c << 8) | d);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      groups.push(parseInt(part, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  if (head === null) return null;

  if (halves.length === 2) {
    const tail = toGroups(halves[1]);
    if (tail === null) return null;
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    return [...head, ...new Array<number>(fill).fill(0), ...tail];
  }

  // No `::` compression: the address must contain exactly 8 groups.
  return head.length === 8 ? head : null;
}

function isPrivateIPv6(ip: string): boolean {
  const groups = parseIPv6(ip);

  // Fail closed: if the address cannot be parsed, treat it as unsafe.
  if (groups === null) return true;

  const topZero = (count: number) =>
    groups.slice(0, count).every(group => group === 0);

  // ::1 (loopback) and :: (unspecified)
  if (topZero(7) && (groups[7] === 0 || groups[7] === 1)) return true;

  // fc00::/7 (unique local addresses)
  if ((groups[0] & 0xfe00) === 0xfc00) return true;

  // fe80::/10 (link-local)
  if ((groups[0] & 0xffc0) === 0xfe80) return true;

  // fec0::/10 (site-local, deprecated but still routable internally)
  if ((groups[0] & 0xffc0) === 0xfec0) return true;

  // ff00::/8 (multicast)
  if ((groups[0] & 0xff00) === 0xff00) return true;

  // Addresses that embed an IPv4 address in their last 32 bits. For these we
  // extract the embedded IPv4 and reuse the IPv4 private-range checks, so that
  // e.g. ::ffff:127.0.0.1 or 64:ff9b::169.254.169.254 are blocked.
  const embedsIPv4 =
    // ::/96 — IPv4-compatible (deprecated)
    topZero(6) ||
    // ::ffff:0:0/96 — IPv4-mapped (ffff in group 5)
    (topZero(5) && groups[5] === 0xffff) ||
    // ::ffff:0:0/96 — IPv4-translated form (ffff in group 4, group 5 zero)
    (topZero(4) && groups[4] === 0xffff && groups[5] === 0) ||
    // 64:ff9b::/96 — NAT64 well-known prefix
    (groups[0] === 0x0064 &&
      groups[1] === 0xff9b &&
      groups[2] === 0 &&
      groups[3] === 0 &&
      groups[4] === 0 &&
      groups[5] === 0) ||
    // 64:ff9b:1::/48 — NAT64 local-use prefix
    (groups[0] === 0x0064 && groups[1] === 0xff9b && groups[2] === 0x0001);

  if (embedsIPv4) {
    const a = (groups[6] >> 8) & 0xff;
    const b = groups[6] & 0xff;
    const c = (groups[7] >> 8) & 0xff;
    const d = groups[7] & 0xff;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }

  return false;
}
