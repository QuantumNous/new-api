declare module 'loader-utils' {
  export function interpolateName(
    loaderContext: unknown,
    name?: string | ((resourcePath: string, resourceQuery?: string) => string),
    options?: {
      context?: string;
      content?: Buffer;
    },
  ): string;
}
