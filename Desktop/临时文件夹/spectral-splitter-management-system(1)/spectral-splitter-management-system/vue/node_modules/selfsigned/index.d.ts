import { pki } from 'node-forge'

declare interface SelfsignedOptions {
  /**
   * The number of days before expiration
   *
   * @default 365 */
  days?: number
  /**
   * the size for the private key in bits
   * @default 1024
   */
  keySize?: number
  /**
   * additional extensions for the certificate
   */
  extensions?: any[];
  /**
   * The signature algorithm sha256 or sha1
   * @default "sha1"
   */
  algorithm?: string
  /**
   * include PKCS#7 as part of the output
   * @default false
   */
  pkcs7?: boolean
  /**
   * generate client cert signed by the original key
   * @default false
   */
  clientCertificate?: undefined
  /**
   * client certificate's common name
   * @default "John Doe jdoe123"
   */
  clientCertificateCN?: string
}

declare interface GenerateResult {
  private: string
  public: string
  cert: string
  fingerprint: string
}

declare function generate(
  attrs?: pki.CertificateField[],
  opts?: SelfsignedOptions
): GenerateResult

declare function generate(
  attrs?: pki.CertificateField[],
  opts?: SelfsignedOptions,
  /** Optional callback, if not provided the generation is synchronous */
  done?: (err: undefined | Error, result: GenerateResult) => any
): void
