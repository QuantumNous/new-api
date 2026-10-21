export type WechatPemFileKind = 'cert' | 'key'

/**
 * Filename hint (relaxed): used only as a pre-filter / UI hint.
 * Matches by substring so common real-world names are accepted:
 *   - "apiclient_cert (1).pem" (browser duplicate download)
 *   - "1746971547_apiclient_cert.pem" (merchant-id prefixed)
 *   - "APIClient_Key.PEM" (mixed case)
 *   - "apiclient_cert.pem.txt" (extra extension)
 * The authoritative decision is made by {@link detectWechatPemKindByContent}.
 */
export function getWechatPemFileKind(
  fileName: string
): WechatPemFileKind | null {
  const normalized = fileName.trim().toLowerCase()
  if (normalized.includes('apiclient_cert')) return 'cert'
  if (normalized.includes('apiclient_key')) return 'key'
  return null
}

/**
 * Content-based detection (authoritative): inspect the PEM header.
 * - certificate => 'cert'
 * - PKCS#8 / PKCS#1 / EC private key => 'key'
 * Returns null when no recognizable PEM block is present.
 */
export function detectWechatPemKindByContent(
  content: string
): WechatPemFileKind | null {
  if (content.includes('-----BEGIN CERTIFICATE-----')) return 'cert'
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content)) return 'key'
  return null
}
