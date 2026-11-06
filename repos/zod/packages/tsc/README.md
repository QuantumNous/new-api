# Zod perftesting

`node generateRandomSchemas.js` to generate some random Zod schemas (pregenerated ones already exist in `src/index.ts`)

`npm run build-bench` to run `tsc` with `extendedDiagnostics`

Either modify zod's typings in `node_modules/zod` or `npm link` a local copy and do modifications there. Remember to build `zod` in between!
