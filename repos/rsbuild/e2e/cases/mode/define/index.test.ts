import { expect, test } from '@e2e/helper';

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

test('should define vars in build correctly', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      mode: 'production',
    },
  });

  const content = await rsbuild.getIndexBundle();

  // Replaced identifiers
  expect(content).toContain('"[value] import.meta.env.MODE","production"');
  expect(content).toContain('"[value] process.env.NODE_ENV","production"');

  // runtime values
  expect(await page.evaluate(() => window['import.meta.env.MODE === "development"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env?.MODE === "development"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env.MODE === "production"'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env?.MODE === "production"'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env.DEV'])).toBe(undefined);
  expect(await page.evaluate(() => window['import.meta.env?.DEV'])).toBe(undefined);
  expect(await page.evaluate(() => window['import.meta.env.PROD'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env?.PROD'])).toBe(true);
  expect(await page.evaluate(() => window.destructedValues)).toBe(
    'MODE:production,DEV:false,PROD:true',
  );

  // dead code elimination
  expect(content).not.toContain('[condition] import.meta.env.MODE === "development"');
  expect(content).not.toContain('[condition] import.meta.env.DEV');
});

test('should define vars in dev', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      mode: 'development',
    },
  });

  const content = await rsbuild.getIndexBundle();

  // Replaced identifiers
  expect(content).toContain(`'[value] import.meta.env.MODE', "development"`);
  expect(content).toContain(`'[value] process.env.NODE_ENV', "development"`);

  // runtime values
  expect(await page.evaluate(() => window['import.meta.env.MODE === "development"'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env?.MODE === "development"'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env.MODE === "production"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env?.MODE === "production"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env.DEV'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env?.DEV'])).toBe(true);
  expect(await page.evaluate(() => window['import.meta.env.PROD'])).toBe(undefined);
  expect(await page.evaluate(() => window['import.meta.env?.PROD'])).toBe(undefined);
  expect(await page.evaluate(() => window.destructedValues)).toBe(
    'MODE:development,DEV:true,PROD:false',
  );
});

test('should define vars in none mode correctly', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview({
    config: {
      mode: 'none',
    },
  });

  const content = await rsbuild.getIndexBundle();

  // Replaced identifiers
  expect(content).toContain(`'[value] import.meta.env.MODE', "none"`);
  expect(content).toContain(`'[value] process.env.NODE_ENV', process.env.NODE_ENV`);

  // runtime values
  expect(await page.evaluate(() => window['import.meta.env.MODE === "development"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env?.MODE === "development"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env.MODE === "production"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env?.MODE === "production"'])).toBe(
    undefined,
  );
  expect(await page.evaluate(() => window['import.meta.env.DEV'])).toBe(undefined);
  expect(await page.evaluate(() => window['import.meta.env?.DEV'])).toBe(undefined);
  expect(await page.evaluate(() => window['import.meta.env.PROD'])).toBe(undefined);
  expect(await page.evaluate(() => window['import.meta.env?.PROD'])).toBe(undefined);
  expect(await page.evaluate(() => window.destructedValues)).toBe('MODE:none,DEV:false,PROD:false');
});

test('should allow to disable NODE_ENV injection', async ({ build }) => {
  const rsbuild = await build({
    config: {
      mode: 'production',
      tools: {
        rspack: {
          optimization: { nodeEnv: false },
        },
      },
    },
  });

  const content = await rsbuild.getIndexBundle();
  expect(content).toContain('[value] process.env.NODE_ENV",process.env.NODE_ENV');
});
