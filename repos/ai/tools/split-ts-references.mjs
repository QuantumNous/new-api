import { readFileSync, writeFileSync } from 'node:fs';

/*
 * `update-ts-references` derives project references from the pnpm workspace,
 * which means it writes a reference for every workspace package — including
 * `examples/*` and `tools/*` — into the root `tsconfig.json`. There is no
 * option to scope which workspaces land in the root config.
 *
 * The desired layout is:
 *   - `tsconfig.json`               -> only `packages/*` references
 *   - `tsconfig.with-examples.json` -> the root config plus `examples/*`
 *
 * This script runs right after `update-ts-references` and re-partitions the
 * references the tool produced into those two configs, dropping everything
 * that is neither a package nor an included example (e.g. `tools/*`).
 */

const ROOT_CONFIG = 'tsconfig.json';
const WITH_EXAMPLES_CONFIG = 'tsconfig.with-examples.json';

/*
 * Examples that cannot be type-checked by `tsc --build` and are therefore kept
 * out of `tsconfig.with-examples.json`. `sveltekit-openai` imports `.svelte`
 * components, whose types are only resolvable via `svelte-check` (which the
 * example runs as its own `type-check` script); under plain `tsc` those imports
 * resolve to the ambient `*.svelte` module and fail.
 */
const EXCLUDED_EXAMPLES = new Set(['examples/sveltekit-openai']);

const isPackageReference = reference => /^packages\/[^/]+$/.test(reference.path);
const isExampleReference = reference =>
  /^examples\/[^/]+$/.test(reference.path) &&
  !EXCLUDED_EXAMPLES.has(reference.path);

const readConfig = file => JSON.parse(readFileSync(file, 'utf8'));
const writeConfig = (file, config) =>
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);

const rootConfig = readConfig(ROOT_CONFIG);
const allReferences = rootConfig.references ?? [];

rootConfig.references = allReferences.filter(isPackageReference);
writeConfig(ROOT_CONFIG, rootConfig);

const withExamplesConfig = readConfig(WITH_EXAMPLES_CONFIG);
withExamplesConfig.references = [
  { path: './' },
  ...allReferences.filter(isExampleReference),
];
writeConfig(WITH_EXAMPLES_CONFIG, withExamplesConfig);
