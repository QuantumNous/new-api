# Rsbuild contribution guide

Thank you for your interest in contributing to Rsbuild! Before you start your contribution, please take a moment to read the following guidelines.

---

## Setup the environment

Fork this repository to your own GitHub account and then clone it locally.

## Branches

- [main](https://github.com/web-infra-dev/rsbuild/tree/main) -> Rsbuild v2.x
- [v1.x](https://github.com/web-infra-dev/rsbuild/tree/v1.x) -> Rsbuild v1.x
- [v0.x](https://github.com/web-infra-dev/rsbuild/tree/v0.x) -> Rsbuild v0.x

### Install Node.js

Use Node.js LTS or newer. For installation instructions, see [Install Node.js](https://nodejs.org/en/download).

### Install dependencies

Enable [pnpm](https://pnpm.io/) with Corepack and install dependencies:

```sh
npm i corepack@latest -g
corepack enable
pnpm install
```

---

## Making changes and building

### Checkout a new branch

Create a dedicated branch for your changes:

```sh
git checkout -b MY_BRANCH_NAME
```

### Build the package

Build the package you want to change:

```sh
pnpm --filter core run build
```

Build everything:

```sh
pnpm run build
```

---

## Testing

### Add new tests

Add tests for every bug fix or feature. Unit tests live in `<PACKAGE_DIR>/tests` and use [Rstest](https://rstest.rs/).

### Run unit tests

Run all unit tests:

```sh
pnpm test
```

Run a single package:

```sh
pnpm test core
```

### Run E2E tests

Run end-to-end tests powered by [Playwright](https://github.com/microsoft/playwright):

```sh
pnpm run e2e
```

If you need to run a specified test, you can add keywords to filter:

```sh
# Only run test cases which contains `css` keyword in file path
pnpm e2e css
```

---

## Linting

Run [Rslint](https://github.com/web-infra-dev/rslint) to keep code style consistent:

```sh
pnpm run lint
```

Install the [Rslint VS Code extension](https://marketplace.visualstudio.com/items?itemName=rstack.rslint) to see lints while typing.

---

## Documentation

You can find the Rsbuild documentation in the [website](./website) folder.

---

## Submitting changes

### Committing your changes

Commit your changes to your forked repo, and [create a pull request](https://help.github.com/articles/creating-a-pull-request/).

> Normally, the commits in a PR will be squashed into one commit, so you don't need to rebase locally.

### Format of PR titles

The format of PR titles follow [Conventional Commits](https://www.conventionalcommits.org/).

An example:

```
feat(core): Add `myOption` config
^    ^    ^
|    |    |__ Subject
|    |_______ Scope
|____________ Type
```

---

## Releasing

Repository maintainers can publish a new version of changed packages to npm.

1. Use `release-core` skill to update the version.
2. Run the [release action](https://github.com/web-infra-dev/rsbuild/actions/workflows/release.yml) to publish packages to npm.
3. Merge the release pull request to `main`.
4. Generate the [release notes](https://github.com/web-infra-dev/rsbuild/releases) via `create-draft-release-notes` skill.
