# @rsbuild/e2e

This folder contains the E2E test cases of Rsbuild. The E2E suite is powered by [Playwright](https://github.com/microsoft/playwright).

## Directory structure

- `cases`: Test cases covering different Rsbuild features.
- `assets`: Common static assets, can be accessed using the `@e2e/assets` package.
- `scripts`: Shared helpers, can be accessed using the `@e2e/helper` package.
- `type-tests`: Test cases for type checking, checked via `rslint --type-check`.

## Commands

```bash
# Run all test cases
pnpm e2e

# Run specific test case, such as "css"
pnpm e2e css
```

## Debugging

If a test directory includes an `rsbuild.config.*` file, you can simply run `npx rsbuild` or `npx rsbuild build` to start it. This approach provides a simpler and more convenient way to debug.

```bash
cd cases/assets/emit-assets
npx rsbuild
npx rsbuild build
```

## Add test cases

```ts
import { expect, test } from '@e2e/helper';
import { toPosixPath } from '@rstackjs/test-utils';

test('normalize path', () => {
  expect(toPosixPath('foo\\bar')).toBe('foo/bar');
});
```

Use `@e2e/helper` for Rsbuild-specific fixtures and helpers. Import generic test utilities directly from `@rstackjs/test-utils`.

You can use the local skill at [`write-e2e-cases`](../.agents/skills/write-e2e-cases/SKILL.md) to add new test cases.
