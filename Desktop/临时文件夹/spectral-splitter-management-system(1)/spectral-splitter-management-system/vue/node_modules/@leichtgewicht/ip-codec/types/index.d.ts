interface Encoder {
  (ip: string): Uint8Array;
  <TIn extends Uint8Array = Uint8Array> (ip: string, buff: TIn, offset?: number): TIn;
}
type Decoder = (ip: Uint8Array, offset?: number) => string;

interface Codec<TName extends string, TSize extends number> {
  name: TName;
  size: TSize;
  encode: Encoder;
  decode: Decoder;
  isFormat(ip: string): boolean;
}

export function sizeOf(ip: string): 4 | 16;
export function familyOf(ip: string): 1 | 2;
export const v4: Codec<"ipv4", 4>;
export const v6: Codec<"ipv6", 16>;
export const name: "ip";
export const encode: {
  (ip: string): Uint8Array;
  <TIn extends Uint8Array = Uint8Array> (ip: string, buff: TIn | ((size: number) => TIn), offset?: number): TIn
};
export function decode(ip: Uint8Array, offset?: number, length?: number): string;

export {};
