---
ref: docs/start/framework/react/guide/tailwind-integration.md
replace:
  {
    '@tanstack/react-start': '@tanstack/solid-start',
    '@tanstack/react-router': '@tanstack/solid-router',
    '@vitejs/plugin-react': 'vite-plugin-solid',
    'viteReact()': 'viteSolid({ ssr: true })',
    'viteReact': 'viteSolid',
    "import { pluginReact } from '@rsbuild/plugin-react'": "import { pluginBabel } from '@rsbuild/plugin-babel'\nimport { pluginSolid } from '@rsbuild/plugin-solid'",
    'pluginReact(),': "pluginBabel({\n      include: /\\.(?:jsx|tsx)$/,
      }),\n    pluginSolid(),",
  }
---
