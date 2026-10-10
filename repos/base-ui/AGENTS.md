# Repository Guidelines

This repository contains the source code and documentation for Base UI: a headless, unstyled React component library.

## Project structure

- Source code for components and private utils is in `packages/react/`.
- Source code for public shared utils is in `packages/utils/`.
- Experiments are located at `docs/src/app/(private)/experiments/`. Use for creating demos that require manual testing in the browser.
- Public documentation is located at `docs/src/app/(docs)/react/`. Alter the docs where necessary when changes must be visible to library users.
- When creating public demos on the docs, refer to the `hero` demo for the given component and largely follow its styles (both CSS Modules and Tailwind CSS versions). Other demos may also contain relevant styling. Do not add custom styling beyond the critical layout styles necessary for new demos.

## Code guidelines

- Always use the `useTimeout` utility from `@base-ui/utils/useTimeout` instead of `window.setTimeout`, and `useAnimationFrame` from `@base-ui/utils/useAnimationFrame` instead of `requestAnimationFrame`. Search for other example usage in the codebase if unsure how to use them.
- Use the `useStableCallback` utility from `@base-ui/utils/useStableCallback` instead of `React.useCallback` if the function is called within an effect or event handler. The utility cannot be used to memoize functions that are called directly in the body of a component (during render), so continue with `React.useCallback` in those scenarios.
- Always use the `useIsoLayoutEffect` utility from `@base-ui/utils/useIsoLayoutEffect` instead of `React.useLayoutEffect`.
- Always use the shadow DOM-safe utilities for DOM traversal and event targeting: `contains`, `getTarget`, and `activeElement`. Always use the owner utilities `ownerDocument` and `ownerWindow` instead of global `document`/`window` lookups when the code is tied to a DOM node, including realm-sensitive checks such as `instanceof`.
- Avoid duplicating logic where necessary. If two components can share logic (such as event handlers), define the logic/handlers in the parent and share it through a context to the child; use the existing context if it exists.

## Styling

- In CSS Modules demos (`docs/src/app/(docs)/**/demos/**/*.module.css`), use raw color values from the Tailwind `@theme` block in `docs/src/css/index.css`. For example, use `oklch(14.5% 0 0deg)` instead of `var(--color-neutral-950)`.
- When using `user-select: none;` in CSS, also add `-webkit-user-select: none;` to support Safari. Tailwind's `select-none` class already includes this.

## Linting, typechecking, and formatting

- Do not randomly cast (for example `as any`) if there are no type errors without doing so. Run `pnpm typescript` to verify types.
- Ensure your changes pass linting - run `pnpm eslint`.
- Ensure your styles pass stylelint - run `pnpm stylelint`.
- Ensure your changes are formatted correctly - run `pnpm prettier`.
- When you change a public component API (props or JSDoc), run `pnpm docs:api`.

## Testing

- If a repository command fails because dependencies are unavailable, run `pnpm i` first and then retry the command.
- Run tests in jsdom env with `pnpm test:jsdom {name} --no-watch` such as `pnpm test:jsdom NumberField --no-watch` or `pnpm test:jsdom parse --no-watch`.
- Run tests in Chromium env with `pnpm test:chromium {name} --no-watch` such as `pnpm test:chromium NumberField --no-watch` or `pnpm test:chromium parse --no-watch`.
- Do not call `await flushMicrotasks()` directly after `await render(...)` when there are no interactions or state changes between them; `render` is already awaited, so that immediate flush is unnecessary.
- Do not group multiple `expect()` assertions in a single `waitFor()` callback. Use one assertion per `waitFor()` so retries are scoped to the specific condition that may change asynchronously.
- If you made changes to the source code, ensure you verify your changes by running tests (see above), and writing new tests where applicable. If tests require the browser because, for example, they require layout measurements, restrict it to the Chromium env by using `it.skipIf(isJSDOM)` or `describe.skipIf(isJSDOM)` (search other tests for example usage if unsure).
- Follow the established conventions in existing tests. Each file/component is tested with the filename `name.test.tsx`. For example, `PopoverRoot.test.tsx` is next to its source file `PopoverRoot.tsx`.
- Tests use Vitest APIs only: `expect()`, `vi.fn()`, and `@testing-library/jest-dom` DOM matchers. Do not use Chai- or Sinon-style matcher chains or spies.

## Commit guidelines

- Commit messages follow the format `[scope] Imperative summary` (for example `[popover] Fix focus trap`). Choose scopes that mirror package or component names that were changed.
- Use `[all components]` scope for changes that broadly affect most components.

## Errors

These guidelines apply only to errors thrown by public packages.

Every error message must:

1. **Say what happened** - Describe the problem clearly
2. **Say why it's a problem** - Explain the consequence
3. **Point toward how to solve it** - Give actionable guidance

Format:

- Prefix with `Base UI:`
- Use string concatenation for readability
- Include a documentation link when applicable (`https://base-ui.com/...`)

### Error Minifier

You MUST run `pnpm extract-error-codes` to update `docs/src/error-codes.json` every time you add or update an error message in an `Error` constructor.

**Important:** If the update created a new error code, but the new and original message have the same number of arguments and semantics haven't changed, update the original error in `error-codes.json` instead of creating a new code.

Before any changes, review [CONTRIBUTING.md](./CONTRIBUTING.md) for more detailed guidelines on contributing to this repository.
