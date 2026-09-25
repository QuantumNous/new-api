# Scripts

## Release

> [!NOTE]
> These instructions are intended for the Base UI core team, who have the permissions required to publish releases.

A typical release goes like this:

### Prepare the release of the packages

1. Create a Git branch off the current main branch.
2. Update the root `/package.json`'s version. It should match the target version of `@base-ui/react`.
3. Generate the changelog with `pnpm release:changelog`
   The output must be prepended to the top level `CHANGELOG.md`.
   Run `pnpm release:changelog --help` for more information.
4. Update the changelog as necessary. In particular, describe all the breaking changes.
5. Generate the changelog in a format suitable for the docs with `pnpm release:changelog:docs`.
6. Create a new release page at `docs/src/app/(docs)/react/overview/releases/<version-slug>/page.mdx` (where `<version-slug>` uses hyphens, for example, `v1-1-0` for v1.1.0). Paste the generated changelog there, following the format of existing release pages (title, `<Subtitle>` with the date, `<Meta>` tag).
7. Copy the changes made in point 4 to the new release page and adapt to the required format.
8. Add a new entry to `docs/src/data/releases.ts` with the version, versionSlug, date, and highlights. Move the `latest: true` flag to the new release if appropriate.
9. Run `pnpm release:version`. Keep the package versions of stable public packages (`@base-ui/react`) the same as the root `package.json` version.
10. Open a PR with changes and wait for review and green CI.
11. When the PR is close to being merged, announce a merge freeze on the Base UI Slack channel so no other changes land on the main branch until the release is published and the docs are deployed.
12. Merge the PR once the CI is green and it has been approved.

### Release the packages

1. Run `pnpm release:publish`. You may be asked to authenticate with GitHub when running the command for the first time or after a very long time.
2. It'll automatically fetch the latest merged release PR and ask for confirmation before publishing.
3. If you already know the sha of the commit, you can pass it directly like `pnpm release:publish --sha <your-sha>`.
4. Other flags for the command:

   > - **--dry-run** Used for debugging. Or directly run `pnpm release:publish:dry-run`.
   > - **--dist-tag** Use to publish legacy or canary versions.

5. This command invokes the [Publish](https://github.com/mui/base-ui/actions/workflows/publish.yml) GitHub action. It'll log the URL which can be opened to see the latest workflow run.
6. The next screen shows "@username requested your review to deploy to npm-publish", click "Review deployments" and authorize your workflow run. **Never approve workflow runs you didn't initiate.**

### Publish the documentation

The documentation must be updated on the `docs-vX` branch (`docs-v1` for `v1.X` releases, `docs-v2` for `v2.X` releases, etc.)

Force-push the latest upstream `master` to the documentation release branch to deploy the documentation with the latest changes:

```bash
pnpm docs:deploy
```

You can follow the deployment process [on the Netlify Dashboard](https://app.netlify.com/sites/base-ui/deploys?filter=docs-v1)
Once deployed, it will be accessible at https://base-ui.netlify.app/ for the `docs-v1` deployment.

Once the docs are deployed, lift the merge freeze on the Base UI Slack channel.

### GitHub release

After the documentation deployment is done, review, and then publish the release that was created in draft mode during the release step [GitHub releases page](https://github.com/mui/base-ui/releases)
Make sure to check the **Set as a pre-release** checkbox if publishing an unstable version.
