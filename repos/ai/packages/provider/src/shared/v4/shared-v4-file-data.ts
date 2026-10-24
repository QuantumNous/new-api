import type { SharedV4ProviderReference } from './shared-v4-provider-reference';

/**
 * File data variant containing raw bytes (`Uint8Array`) or a base64-encoded
 * string.
 */
export interface SharedV4FileDataData {
  type: 'data';
  data: Uint8Array | string;
}

/**
 * File data variant containing a URL that points to the file.
 */
export interface SharedV4FileDataUrl {
  type: 'url';
  url: URL;
}

/**
 * File data variant containing a provider reference (`{ [provider]: id }`).
 */
export interface SharedV4FileDataReference {
  type: 'reference';
  reference: SharedV4ProviderReference;
}

/**
 * File data variant containing inline text content (e.g. an inline text
 * document).
 */
export interface SharedV4FileDataText {
  type: 'text';
  text: string;
}

/**
 * File data as a tagged discriminated union:
 *
 * - `{ type: 'data', data }`: raw bytes (`Uint8Array`) or base64-encoded string.
 * - `{ type: 'url', url }`: a URL that points to the file.
 * - `{ type: 'reference', reference }`: a provider reference (`{ [provider]: id }`).
 * - `{ type: 'text', text }`: inline text content (e.g. an inline text document).
 */
export type SharedV4FileData =
  | SharedV4FileDataData
  | SharedV4FileDataUrl
  | SharedV4FileDataReference
  | SharedV4FileDataText;
