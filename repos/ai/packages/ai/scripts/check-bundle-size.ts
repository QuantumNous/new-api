import { build } from 'esbuild';
import { writeFileSync, statSync } from 'fs';
import { join } from 'path';

// Bundle size limits in bytes
const LIMIT = 640 * 1024;

interface BundleResult {
  size: number;
  path: string;
  condition: string;
}

async function bundleForNode(): Promise<BundleResult> {
  const outfile = join(process.cwd(), 'dist-bundle-check', 'node.js');
  const metafile = join(process.cwd(), 'dist-bundle-check', 'node-meta.json');

  const result = await build({
    entryPoints: [join(process.cwd(), 'src', 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'es2020',
    format: 'esm',
    outfile,
    metafile: true,
    minify: true,
    treeShaking: true,
    external: ['arktype', 'effect', '@valibot/to-json-schema'],
  });
  writeFileSync(metafile, JSON.stringify(result.metafile, null, 2));

  const size = statSync(outfile).size;
  return { size, path: outfile, condition: 'node' };
}

async function bundleForBrowser(): Promise<BundleResult> {
  const outfile = join(process.cwd(), 'dist-bundle-check', 'browser.js');
  const metafile = join(
    process.cwd(),
    'dist-bundle-check',
    'browser-meta.json',
  );

  const result = await build({
    entryPoints: [join(process.cwd(), 'src', 'index.ts')],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'esm',
    outfile,
    metafile: true,
    minify: true,
    treeShaking: true,
    conditions: ['browser'],
    external: ['arktype', 'effect', '@valibot/to-json-schema'],
  });
  writeFileSync(metafile, JSON.stringify(result.metafile, null, 2));

  const size = statSync(outfile).size;
  return { size, path: outfile, condition: 'browser' };
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function checkSize(result: BundleResult, limit: number): boolean {
  const passed = result.size <= limit;
  const status = passed ? '✅' : '❌';
  const percentage = ((result.size / limit) * 100).toFixed(1);

  console.log(
    `${status} ${result.condition.padEnd(10)} ${formatSize(result.size).padEnd(12)} (${percentage}% of ${formatSize(limit)} limit)`,
  );

  return passed;
}

async function main() {
  console.log('📦 Checking bundle sizes...\n');

  try {
    const [nodeResult, browserResult] = await Promise.all([
      bundleForNode(),
      bundleForBrowser(),
    ]);

    console.log('Bundle sizes:');
    const nodePass = checkSize(nodeResult, LIMIT);
    const browserPass = checkSize(browserResult, LIMIT);

    console.log('\n---');

    console.log('📦 Bundle size check complete.');
    console.log(
      'Upload dist-bundle-check/*.json files to https://esbuild.github.io/analyze/ for detailed analysis.',
    );

    console.log('\n---');

    if (nodePass && browserPass) {
      console.log('✅ All bundle size checks passed!');
      process.exit(0);
    } else {
      console.log('❌ Bundle size check failed!');
      console.log('\nTo fix this, either:');
      console.log('1. Reduce the bundle size by optimizing code');
      console.log(
        '2. Update the limit at https://github.com/vercel/ai/settings/variables/actions/BUNDLE_SIZE_LIMIT_KB',
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during bundle size check:', error);
    process.exit(1);
  }
}

main();
