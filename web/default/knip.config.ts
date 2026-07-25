import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  // Tests are run by vitest rather than imported, static-keys.ts exists so the
  // i18n tooling keeps runtime-built keys, and .d.ts files only augment modules.
  entry: ['src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/i18n/static-keys.ts'],
  ignore: ['src/components/ui/**', 'src/**/*.d.ts'],
  // tailwindcss and auto-skeleton-react are pulled in from CSS, the rest are
  // only referenced by the ignored src/components/ui primitives.
  ignoreDependencies: [
    'auto-skeleton-react',
    'react-resizable-panels',
    'embla-carousel-react',
  ],
}

export default config
