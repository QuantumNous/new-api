// TODO discuss do we want to copy this interface into Start we well?
import type { CookieSerializeOptions } from 'cookie-es'

// TODO discuss do we want to copy this interface into Start as shown below?

/** Algorithm used for encryption and decryption. */
type EncryptionAlgorithm = 'aes-128-ctr' | 'aes-256-cbc'
/** Algorithm used for integrity verification. */
type IntegrityAlgorithm = 'sha256'
/** @internal */
type _Algorithm = EncryptionAlgorithm | IntegrityAlgorithm
/**
 * Options for customizing the key derivation algorithm used to generate encryption and integrity verification keys as well as the algorithms and salt sizes used.
 */
type SealOptions = Readonly<{
  /** Encryption step options. */
  encryption: SealOptionsSub<EncryptionAlgorithm>
  /** Integrity step options. */
  integrity: SealOptionsSub<IntegrityAlgorithm>
  /* Sealed object lifetime in milliseconds where 0 means forever. Defaults to 0. */
  ttl: number
  /** Number of seconds of permitted clock skew for incoming expirations. Defaults to 60 seconds. */
  timestampSkewSec: number
  /**
   * Local clock time offset, expressed in number of milliseconds (positive or negative). Defaults to 0.
   */
  localtimeOffsetMsec: number
}>
/** `seal()` method options. */
type SealOptionsSub<TAlgorithm extends _Algorithm = _Algorithm> = Readonly<{
  /** The length of the salt (random buffer used to ensure that two identical objects will generate a different encrypted result). Defaults to 256. */
  saltBits: number
  /** The algorithm used. Defaults to 'aes-256-cbc' for encryption and 'sha256' for integrity. */
  algorithm: TAlgorithm
  /** The number of iterations used to derive a key from the password. Defaults to 1. */
  iterations: number
  /** Minimum password size. Defaults to 32. */
  minPasswordlength: number
}>
/** Password secret string or buffer.*/

type SessionDataT = Record<string, any>
export type SessionData<T extends SessionDataT = SessionDataT> = Partial<T>
export interface Session<T extends SessionDataT = SessionDataT> {
  id: string
  createdAt: number
  data: SessionData<T>
}

export type SessionUpdate<T extends SessionData = SessionData> =
  | Partial<SessionData<T>>
  | ((oldData: SessionData<T>) => Partial<SessionData<T>> | undefined)

export interface SessionManager<T extends SessionDataT = SessionDataT> {
  readonly id: string | undefined
  readonly data: SessionData<T>
  update: (update: SessionUpdate<T>) => Promise<SessionManager<T>>
  clear: () => Promise<SessionManager<T>>
}
export interface SessionConfig {
  /** Private key used to encrypt session tokens */
  password: string
  /** Session expiration time in seconds */
  maxAge?: number
  /** default is 'start' */
  name?: string
  /** Default is secure, httpOnly, / */
  cookie?: false | CookieSerializeOptions
  /** Default is x-start-session / x-{name}-session */
  sessionHeader?: false | string
  seal?: SealOptions
  crypto?: Crypto
  /** Default is Crypto.randomUUID */
  generateId?: () => string
}
