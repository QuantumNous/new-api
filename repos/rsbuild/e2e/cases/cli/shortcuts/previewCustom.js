import { createRsbuild } from '@rsbuild/core';

process.stdin.isTTY = true;
delete process.env.CI;

async function main() {
  const rsbuild = await createRsbuild({
    cwd: import.meta.dirname,
    config: {
      dev: {
        cliShortcuts: {
          custom: (shortcuts) => {
            return [
              ...shortcuts,
              {
                key: 's',
                description: 'say hello',
                action: () => {
                  console.log('hello world!');
                },
              },
            ];
          },
        },
      },
    },
  });

  await rsbuild.build();
  await rsbuild.preview();
}

await main();
