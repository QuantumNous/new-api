# Contributing to the AI SDK

We deeply appreciate your interest in contributing to our repository! Whether you're reporting bugs, suggesting enhancements, improving docs, sharing community projects, building provider integrations, or submitting pull requests, your contributions help improve the project for everyone.

## How We Value Contributions

AI SDK maintenance is becoming increasingly automated. Maintainers and automated workflows will take on more of the routine work involved in reviewing new issues, triaging reports, reproducing bugs, and preparing bug fix pull requests.

Because of this, the most helpful contribution is often a high-quality issue rather than a complete pull request. Clear bug reports, minimal reproductions, failing tests, precise documentation feedback, and thoughtful feature requests help us understand the problem and make better fixes for everyone.

Pull requests are still welcome, especially when they:

- Fix documentation, examples, or typos.
- Add a failing test or reproduction that precisely captures a bug.
- Clarify an issue with a small, focused change.
- Improve the quality of an existing fix with valuable review or context.
- Contribute community-maintained examples, integrations, or provider implementations.

You do not need to send a full implementation for maintainers to value your contribution. When an issue leads to a bug fix pull request, we will credit the issue author with co-authorship where appropriate. Pull request authors will also be credited when their work adds valuable input to resolving a bug report or improves the quality of the fix.

We know this transition may feel different from how open source contribution has traditionally worked. We value our community and all the ways people help AI SDK grow. If this process creates friction or frustration, please open a `feedback` issue and tell us what is not working.

## Reporting Bugs

If you've encountered a bug in the project, we encourage you to report it to us. Please follow these steps:

1. **Check the Issue Tracker**: Before submitting a new bug report, please check our issue tracker to see if the bug has already been reported. If it has, you can add to the existing report.
2. **Create a New Issue**: If the bug hasn't been reported, create a new issue. Provide a clear title and a detailed description of the bug. Include any relevant logs, error messages, and steps to reproduce the issue.
3. **Add a reproduction when possible**: A minimal repository, StackBlitz, failing test, or small runnable example is often the fastest path to a fix.
4. **Link related work**: If you opened a pull request with a failing test, reproduction, or suggested fix, link it from the issue so maintainers can credit the relevant contributors.

## Suggesting Enhancements

We're always looking for suggestions to make our project better. If you have an idea for an enhancement, please:

1. **Check the Issue Tracker**: Similar to bug reports, please check if someone else has already suggested the enhancement. If so, feel free to add your thoughts to the existing issue.
2. **Create a New Issue**: If your enhancement hasn't been suggested yet, create a new issue. Provide a detailed description of your suggested enhancement and how it would benefit the project.

## Sharing Feedback

Use the `feedback` issue type for community feedback, process feedback, or ideas about how to make AI SDK a better project to use and contribute to. This is the best place to tell us how the move toward more automated maintenance is affecting you.

## Improving Documentation

Documentation is crucial for understanding and using our project effectively.
You can find the content of our docs under [`content`](https://github.com/vercel/ai/tree/main/content).

To fix smaller typos, you can edit the code directly in GitHub or use Github.dev (press `.` in Github).

If you want to make larger changes, please check out the Code Contributions section below. It also explains how to fix prettier issues that you might encounter during your docs changes.

## Code Contributions

We welcome your contributions to our code and documentation. Here's how you can contribute:

### Environment Setup

AI SDK development requires PNPM v9 (lockfile version) or higher and Node v22.

### Setting Up the Repository Locally

To set up the repository on your local machine, follow these steps:

1. **Fork the Repository**: Make a copy of the repository to your GitHub account.
2. **Clone the Repository**: Clone the repository to your local machine, e.g. using `git clone`.
3. **Install Node**: If you haven't already, install Node v22.
4. **Install pnpm**: If you haven't already, install pnpm v10. You can do this by running `npm install -g pnpm@10` if you're using npm. Alternatively, if you're using Homebrew (Mac), you can run `brew install pnpm`. For more see [the pnpm site](https://pnpm.io/installation).
5. **Install Dependencies**: Navigate to the project directory and run `pnpm install` to install all necessary dependencies. This also sets up Git hooks via Husky.
6. **Build the Project**: Run `pnpm build` in the root to build all packages.

### Using Git Worktrees

If you work on multiple branches in parallel using [git worktrees](https://git-scm.com/docs/git-worktree), run `pnpm worktree:setup` from the root of a newly created worktree. This symlinks the `.env` files (root, `examples/ai-functions`, and `examples/ai-e2e-next`) from your main worktree into the new one and runs `pnpm install`.

Tip: consider automating this so you don't have to remember it on every new worktree — for example, by wrapping `git worktree add` in a shell alias/function that `cd`s into the new directory and runs `pnpm worktree:setup`, or by invoking it from a `post-checkout` hook (which fires on `git worktree add`).

### Running the Examples

1. `cd examples/ai-functions` (for AI SDK Core, or another example folder)
1. AI SDK Core examples: run e.g. `pnpm tsx src/stream-text/openai.ts`
   - For most examples, you need to provide relevant API keys, e.g. environment variables like `OPENAI_API_KEY`
1. Other framework examples: run `pnpm dev` and go to the browser url

### Local Development Workflow

#### Building Packages

To build the package that you're working on, run `pnpm build` or `pnpm build:watch` in the package folder.
This command updates the `dist` folder with the new version of the package.
Once built, the new code is picked up by the examples.

#### Testing Packages

To test the package that you're working on, run `pnpm test` in the package folder.
You do not need to rebuild your package to test it (only dependencies need to be built).
Some packages like `ai` also have more details tests and watch mode, see their `package.json` for more information.

#### Adding package dependencies

Please run `pnpm update-references` in workspace root to update the `references` section in the `tsconfig.json` file.

### Submitting Pull Requests

We greatly appreciate focused pull requests. Before investing in a full implementation for a bug fix, please consider opening or improving an issue first. Maintainers and automated workflows may prepare the final fix, and we will credit high-quality reports that lead to fixes.

Pull requests are most helpful when they include documentation fixes, reproduction examples, failing tests, or small focused changes that make the issue clearer.

Here are the steps to submit them:

1. **Create a New Branch**: Initiate your changes in a fresh branch. It's recommended to name the branch in a manner that signifies the changes you're implementing.
2. **Add a patch changeset**: If you update any packages, add a **patch** changeset to your branch by running `pnpm changeset` in the workspace root.
   - **Please do not use minor or major changesets**, we'll let you know when you need to use a different changeset type than patch.
   - Changesets should always be created when any API or behavior is changed. We also recommend it for large refactors, just in case an uncaught regression is introduced.
   - You don't need to create changesets for docs or any of the `examples/*` packages, as they are not released. But, if you change a `README.md`, create a changeset so that the package's documentation on npm's website is updated.

3. **Add a codemod**: If the change introduces a deprecation or a breaking change, add a codemod if possible. See [how to contribute codemods](contributing/codemods.md)
4. **Commit Your Changes**: Ensure your commits are succinct and clear, detailing what modifications have been made and the reasons behind them. We don't require a specific commit message format, but please be descriptive.
5. **Sign Your Commits**: All commits must be [signed](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits). Pull requests with unsigned commits cannot be merged.
6. **Pre-commit hooks**: A pre-commit hook automatically formats your staged files using `lint-staged` when you commit. If you stage any `package.json` changes, `pnpm install` runs automatically to keep the lockfile in sync. If you need to skip these hooks (e.g., for work-in-progress commits), set `ARTISANAL_MODE=1` before committing: `ARTISANAL_MODE=1 git commit -m "message"`.
7. **Push the Changes to Your GitHub Repository**: After committing your changes, push them to your GitHub repository.
8. **Open a Pull Request**: Propose your changes for review. Furnish a lucid title and description of your contributions. Make sure to link any relevant issues your PR resolves. We use the following PR title format:
   - `fix(package-name): description` or
   - `feat(package-name): description` or
   - `chore(package-name): description` etc.

9. **Respond to Feedback**: Stay receptive to and address any feedback or alteration requests from the project maintainers.

Thank you for contributing to the AI SDK! Your efforts help us improve the project for everyone.

## Learn More

We have additional contributor documentation in the `contributing/` folder.
