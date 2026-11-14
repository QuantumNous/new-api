import { expect, test } from '@e2e/helper';
import { pluginReact } from '@rsbuild/plugin-react';

const cases = [
  {
    name: 'assets(dataUriLimit 0)',
    cwd: import.meta.dirname,
    config: {
      output: {
        dataUriLimit: 0,
      },
    },
    expected: 'url',
  },
  {
    name: 'assets(dataUriLimit.image 0)',
    cwd: import.meta.dirname,
    config: {
      output: {
        dataUriLimit: {
          image: 0,
        },
      },
    },
    expected: 'url',
  },
  {
    name: 'assets(dataUriLimit max number)',
    cwd: import.meta.dirname,
    config: {
      output: {
        dataUriLimit: {
          image: Number.MAX_SAFE_INTEGER,
        },
      },
    },
    expected: 'inline',
  },
];

for (const item of cases) {
  test(item.name, async ({ page, buildPreview }) => {
    await buildPreview({
      config: {
        ...(item.config || {}),
        plugins: [pluginReact()],
      },
    });

    if (item.expected === 'url') {
      await expect(
        page.evaluate(`document.getElementById('test-img').src.includes('static/image/icon')`),
      ).resolves.toBeTruthy();
    } else {
      await expect(
        page.evaluate(`document.getElementById('test-img').src.startsWith('data:image/png')`),
      ).resolves.toBeTruthy();
    }
  });
}
