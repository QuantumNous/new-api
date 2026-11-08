import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: ['src/shared/components/ui/**', 'src/routeTree.gen.ts'],
  ignoreDependencies: ['tailwindcss', 'tw-animate-css'],
}

export default config
