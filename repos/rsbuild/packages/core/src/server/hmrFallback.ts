import { LOCALHOST } from '../constants';
import { isWildcardHost } from './helper';

/**
 * Checks if localhost resolves differently between node's default DNS lookup
 * and explicit DNS lookup.
 *
 * Returns the resolved address if there's a difference, undefined otherwise.
 * This helps detect cases where IPv4/IPv6 resolution might vary.
 */
async function getLocalhostResolvedAddress(): Promise<string | undefined> {
  const { promises: dns } = await import('node:dns');
  const [defaultLookup, explicitLookup] = await Promise.all([
    dns.lookup(LOCALHOST),
    dns.lookup(LOCALHOST, { verbatim: true }),
  ]);
  const match =
    defaultLookup.family === explicitLookup.family &&
    defaultLookup.address === explicitLookup.address;
  return match ? undefined : defaultLookup.address;
}

export async function resolveHostname(host: string | undefined = LOCALHOST): Promise<string> {
  if (host === LOCALHOST) {
    const resolvedAddress = await getLocalhostResolvedAddress();
    if (resolvedAddress) {
      return resolvedAddress;
    }
  }

  // If possible, set the host name to localhost
  return host === undefined || isWildcardHost(host) ? LOCALHOST : host;
}
