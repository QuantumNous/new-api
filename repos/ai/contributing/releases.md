# Releases - for maintainers only

We use [changesets](https://github.com/changesets/action) for automated releases.

## Changesets

- Every pull request that modifies production code (not `examples`/`docs`) must include a changeset.
- By default, use `patch` (non-breaking).
- To override, apply the `minor` or `major` label (CI enforces `patch` otherwise).

## Regular Releases

- The [Changesets action](https://github.com/changesets/action) automatically creates a **Version Packages** PR.
- Merging this PR triggers the release workflow, which publishes the npm packages.

## Maintenance Releases

- Enable the [`release` workflow](https://github.com/vercel/ai/blob/main/.github/workflows/release.yml) on the maintenance branch.
- Only `patch` releases are allowed.
- To release:
  1. Create a pull request against the maintenance branch.
  2. Merge it to trigger the release workflow.

## Beta / Pre-Release Cycle

For starting and managing a major-version pre-release cycle (beta releases on `main` while maintaining stable patches), see **[Pre-Release Cycle](./pre-release-cycle.md)**.

Quick reference:

- Enter beta mode: `pnpm changeset pre enter beta`
- Exit beta mode: `pnpm changeset pre exit`
- Backport fixes: add the `backport` label to the merged PR

## Snapshot Releases

For test purposes (e.g. to validate whether a certain PR fixes a downstream bug), you can trigger snapshot releases based on the PR branch.

Manually dispatch the [release workflow](https://github.com/vercel/ai/actions/workflows/release.yml), selecting the PR branch and enabling the checkbox to ensure it is a snapshot release.

## New Major Releases

- Update version in `skills/use-ai-sdk/SKILL.md`.

## Provenance

All packages are published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements). This is enabled via:

- `publishConfig.provenance: true` in each package's `package.json`
- `id-token: write` permission in `.github/workflows/release.yml`
- A [Trusted Publisher](https://docs.npmjs.com/trusted-publishers) configured per package on npmjs.com, pointing at `vercel/ai` and `release.yml`

For an existing package, no action is required — provenance is emitted automatically on every publish. For a **new** package, see [Bootstrapping a new `@ai-sdk/*` package](#bootstrapping-a-new-ai-sdk-package) below.

### Bootstrapping a new `@ai-sdk/*` package

npm requires a package to exist before a Trusted Publisher can be configured for it. The first publish therefore has to happen manually, before the package is wired into the monorepo's release workflow. This must be done by a member of the Vercel IT team who has publish rights on the `@ai-sdk` npm scope.

Steps:

1. Create a new empty folder outside the monorepo.
2. `cd` into that folder.
3. Create a `package.json` from the template below, replacing `<package-name>`:

   ```json
   {
     "name": "@ai-sdk/<package-name>",
     "version": "0.0.0"
   }
   ```

4. Run `npm publish`.
5. Open `https://www.npmjs.com/package/@ai-sdk/<package-name>/access` and configure the Trusted Publisher with:
   - **Publisher:** GitHub Actions
   - **Organization or user:** `vercel`
   - **Repository:** `ai`
   - **Workflow name:** `release.yml`
   - **Environment name:** _(leave empty)_

After this is done, subsequent releases of the package go through the normal changesets flow on `main`.
