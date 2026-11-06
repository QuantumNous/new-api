---
ref: docs/start/framework/react/guide/hosting.md
replace:
  {
    '@tanstack/react-start': '@tanstack/solid-start',
    '@vitejs/plugin-react': 'vite-plugin-solid',
    'viteReact()': 'viteSolid({ ssr: true })',
    'viteReact': 'viteSolid',
    'examples/react/start-basic-cloudflare': 'examples/solid/start-basic-cloudflare',
    'examples/react/start-bun': 'examples/solid/start-bun',
    'React 19': 'Solid 1.x',
    'React 18': 'an older Solid version',
    '`react` and `react-dom` packages are set to version 19.0.0 or higher': '`solid-js` package is set to a supported version',
    'bun install react@19 react-dom@19': 'bun install solid-js@latest',
  }
---
