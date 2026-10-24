# AI Function Examples

This directory contains scripts and test suites for quickly and easily validating, testing, and iterating on `ai` functions across providers.

## Basic Examples

Basic examples for the `ai` functions (script usage).

### Usage

1. Create a `.env` file with the following content (and more settings, depending on the providers you want to use):

```sh
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
...
```

2. Run the following commands from the root directory of the AI SDK repo:

```sh
pnpm install
pnpm build
```

3. Run any example (from the `examples/ai-functions` directory) with the following command:

```sh
pnpm tsx src/path/to/example.ts
```

## End-to-end Provider Integration Tests

There are a set of end-to-end provider integration tests under `src/e2e`. These tests are not run on the CI pipeline -- they are only run manually. Failures can be seen due to external issues e.g. quota restrictions, vendor-side changes, missing or stale credentials, etc.

The intent is to allow an easy way for an AI SDK developer to smoke-test provider support for a set of common features. Test filtering can allow slicing to a subset of tests. Most of the test cases in these end-to-end tests are also represented in some form as basic example scripts in the appropriate sub-directory of the `src` directory.

```sh
pnpm run test:e2e:all
```

or a single file:

```sh
pnpm run test:file src/e2e/google.test.ts
```

filter to a subset of test cases:

```sh
pnpm run test:file src/e2e/google.test.ts -t stream
```
