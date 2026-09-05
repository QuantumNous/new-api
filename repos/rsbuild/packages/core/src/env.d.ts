import './types';

declare global {
  const RSBUILD_VERSION: string;
  const BUILD_HASH: string;
  const Deno: unknown;
}

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * @experimental
     */
    RSPACK_UNSAFE_FAST_DROP?: string;
  }
}
