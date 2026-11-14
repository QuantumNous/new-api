# end-to-end testing

End-to-end tests (short <abbr title="end-to-end">e2e</abbr>) are split into two parts:

1. The rendered UI, or test fixtures
2. Instrumentation of fixtures with a simple Vite app

## Rendered UI

The composition of all tests happens in [`./main.tsx`](./main.tsx).
The rendered UI is located inside a separate file in `./fixtures` and written as a React component.
If you're adding a new test prefer a new component instead of editing existing files since that might unknowingly alter existing tests.

## Instrumentation

We're using [`playwright`](https://playwright.dev) to replay user actions.
Each test tests only a single fixture.
A fixture can be loaded with `await renderFixture(fixturePath)`, for example `renderFixture('FocusTrap/OpenFocusTrap')`.

## Commands

For development `pnpm test:e2e:dev` and `pnpm test:e2e:run --watch` in separate terminals is recommended.

| command                | description                                                                                   |
| :--------------------- | :-------------------------------------------------------------------------------------------- |
| `pnpm test:e2e`        | Full run                                                                                      |
| `pnpm test:e2e:dev`    | Prepares the fixtures and runs a Vite dev server                                              |
| `pnpm test:e2e:run`    | Runs the tests (requires `pnpm test:e2e:dev` or `pnpm test:e2e:build`+`pnpm test:e2e:server`) |
| `pnpm test:e2e:build`  | Builds the Vite bundle for viewing fixtures                                                   |
| `pnpm test:e2e:server` | Serves the fixture bundle.                                                                    |
