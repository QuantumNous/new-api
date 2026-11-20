import { createRsbuild } from '@rsbuild/core';

process.stdin.isTTY = true;
delete process.env.CI;

const entry = Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => [`route${index}`, './src/index.js']),
);

async function main() {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      source: {
        entry,
      },
      dev: {
        cliShortcuts: false,
      },
    },
  });

  await rsbuild.startDevServer();
}

await main();
