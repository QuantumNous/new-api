# Contributing

- Clone the repo
  - `gh repo clone TanStack/router`
- Ensure `node` is installed
  - https://nodejs.org/en/
- Ensure `pnpm` is installed
  - https://pnpm.io/installation
  - Why? We use `pnpm` to manage workspace dependencies. It's easily the best monorepo/workspace experience available as of when this was written.
- Install dependencies
  - `pnpm install`
  - This installs dependencies for all of the packages in the monorepo, even examples!
  - Dependencies inside of the packages and examples are automatically linked together as local/dynamic dependencies.
- Install test dependencies
  - `pnpm exec playwright install` (required for e2e tests)
- Run the build or dev watcher
  - `pnpm build:all` (build all packages) or
  - `pnpm build` (cached build with [nx affected](https://nx.dev/nx-api/nx/documents/affected)) or
  - `pnpm dev`
- Navigate to an example
  - `cd examples/react/basic`
- Run the example
  - `pnpm dev`
- Make changes to the code
  - If you ran `pnpm dev` the dev watcher will automatically rebuild the code that has changed
- Editing the docs locally and previewing the changes
  - The documentations for all the TanStack projects are hosted on [tanstack.com](https://tanstack.com), which is a TanStack Start application (https://github.com/TanStack/tanstack.com). You need to run this app locally to preview your changes in the `TanStack/router` docs.

> [!NOTE]
> The website fetches the doc pages from GitHub in production, and searches for them at `../router/docs` in development. Your local clone of `TanStack/router` needs to be in the same directory as the local clone of `TanStack/tanstack.com`.

You can follow these steps to set up the docs for local development:

1. Make a new directory called `tanstack`.

```sh
mkdir tanstack
```

2. Enter that directory and clone the [`TanStack/router`](https://github.com/TanStack/router) and [`TanStack/tanstack.com`](https://github.com/TanStack/tanstack.com) repos.

```sh
cd tanstack
git clone git@github.com:TanStack/router.git
# We probably don't need all the branches and commit history
# from the `tanstack.com` repo, so let's just create a shallow
# clone of the latest version of the `main` branch.
# Read more about shallow clones here:
# https://github.blog/2020-12-21-get-up-to-speed-with-partial-clone-and-shallow-clone/#user-content-shallow-clones
git clone git@github.com:TanStack/tanstack.com.git --depth=1 --single-branch --branch=main
```

> [!NOTE]
> Your `tanstack` directory should look like this:
>
> ```
> tanstack/
>    |
>    +-- router/ (<-- this directory cannot be called anything else!)
>    |
>    +-- tanstack.com/
> ```

3. Enter the `tanstack/tanstack.com` directory, install the dependencies and run the app in dev mode:

```sh
cd tanstack.com
pnpm i
# The app will run on https://localhost:3000 by default
pnpm dev
```

4. Now you can visit http://localhost:3000/router/latest/docs/framework/react/overview in the browser and see the changes you make in `tanstack/router/docs` there.

> [!WARNING]
> You will need to update the `docs/(router or start)config.json` file (in `TanStack/router`) if you add a new documentation page!

You can see the whole process in the screen capture below:

https://github.com/fulopkovacs/form/assets/43729152/9d35a3c3-8153-4e74-9cb2-af275f7a269b
