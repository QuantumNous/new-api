---
ref: docs/start/framework/react/guide/environment-variables.md
replace:
  {
    '@tanstack/react-start': '@tanstack/solid-start',
    '@tanstack/react-router': '@tanstack/solid-router',
    'React.ReactNode': 'any',
    'export function ApiProvider({ children }: { children: React.ReactNode }) {': 'export function ApiProvider(props) {',
    'export function AuthProvider({ children }: { children: React.ReactNode }) {': 'export function AuthProvider(props) {',
    '{children}': '{props.children}',
    '@tanstack/react-start/plugin/vite': '@tanstack/solid-start/plugin/vite',
    '@tanstack/react-start/plugin/rsbuild': '@tanstack/solid-start/plugin/rsbuild',
    '@vitejs/plugin-react': 'vite-plugin-solid',
    'viteReact()': 'viteSolid({ ssr: true })',
    'viteReact': 'viteSolid',
    "import { pluginReact } from '@rsbuild/plugin-react'": "import { pluginBabel } from '@rsbuild/plugin-babel'\nimport { pluginSolid } from '@rsbuild/plugin-solid'",
    'pluginReact(),': "pluginBabel({\n      include: /\\.(?:jsx|tsx)$/,
      }),\n    pluginSolid(),",
  }
---
