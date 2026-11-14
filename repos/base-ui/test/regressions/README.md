# Visual regression testing

Visual regression tests are split into two parts:

1. The rendered UI, or test fixtures
2. Instrumentation of fixtures with a simple Vite app

## Rendered UI

The composition of all tests happens in [`./main.tsx`](./main.tsx).
The rendered UI is either:

1. located inside a separate file in `./fixtures` and written as a React component.

   Here is an [example](https://github.com/mui/material-ui/blob/814fb60bbd8e500517b2307b6a297a638838ca89/test/regressions/tests/Menu/SimpleMenuList.js#L6-L16) with the `Menu` component.

2. a demo from `docs/src/app/(docs)/react`

   By default all demos are included.
   We exclude demos if they are redundant or flaky etc.
   The logic for this exclusion is handled (like the composition) in [`./main.tsx`](./main.tsx)

If you introduce new behavior, prefer adding a demo to the documentation to solve documentation and testing with one file.
If you're adding a new test prefer a new component instead of editing existing files since that might unknowingly alter existing tests.

## Instrumentation

### Manual

`pnpm test:regressions:dev` will build all fixtures and render an overview page that lists all fixtures.
This can be used to debug individual fixtures.
By default, a devtools-like view is shown that can be disabled by appending `#no-dev` to the URL, for example `http://localhost:5173/docs-components-checkbox-group-demos-hero-tailwind/index.tsx#no-dev` or forced by appending `#dev` to the URL, for example `http://localhost:5173/docs-components-checkbox-group-demos-hero-tailwind/index.tsx#dev`.

### Automatic

We're using [`playwright`](https://playwright.dev) to iterate over each fixture and take a screenshot.
It allows catching regressions like this one:

![before](/test/docs-regressions-before.png)
![diff](/test/docs-regressions-diff.png)

Screenshots are saved in `./screenshots/$BROWSER_NAME/`.
Each test tests only a single fixture.
A fixture can be loaded with `await renderFixture(fixturePath)`, for example `renderFixture('FocusTrap/OpenFocusTrap')`.

## Commands

For development run `pnpm test:regressions:dev`.

| command                        | description                                                                                                           |
| :----------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:regressions`        | Full run                                                                                                              |
| `pnpm test:regressions:dev`    | Prepares the fixtures and runs a Vite dev server                                                                      |
| `pnpm test:regressions:run`    | Runs the tests (requires `pnpm test:regressions:dev` or `pnpm test:regressions:build`+`pnpm test:regressions:server`) |
| `pnpm test:regressions:build`  | Builds the Vite bundle for viewing fixtures                                                                           |
| `pnpm test:regressions:server` | Serves the fixture bundle.                                                                                            |
