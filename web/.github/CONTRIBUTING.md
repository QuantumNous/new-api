# Contributing to Shadcn-Admin

Thank you for considering contributing to **shadcn-admin**! Every contribution is valuable, whether it's reporting bugs, suggesting improvements, adding features, or refining README.

## Table of Contents

1. [Getting Started](#getting-started)
2. [How to Contribute](#how-to-contribute)
3. [Code Standards](#code-standards)
4. [Pull Request Guidelines](#pull-request-guidelines)
5. [Reporting Issues](#reporting-issues)
6. [Community Guidelines](#community-guidelines)

---

## Getting Started

1. **Fork** the repository.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/your-username/shadcn-admin.git
   ```

3. **Install dependencies:**

   ```bash
   pnpm install
   ```

4. **Run the project locally:**

   ```bash
   pnpm dev
   ```

5. Create a new branch for your contribution:

   ```bash
   git checkout -b feature/your-feature
   ```

---

## How to Contribute

- **Feature Requests:** Open an issue or start a discussion to discuss the feature before implementation.
- **Bug Fixes:** Provide clear reproduction steps in your issue.
- **Documentation:** Improvements to the documentation (README) are always appreciated.

> **Note:** Pull Requests adding new features without a prior issue or discussion will **not be accepted**.

---

## Code Standards

- Follow the existing **ESLint** and **Prettier** configurations.
- Ensure your code is **type-safe** with **TypeScript**.
- Maintain consistency with the existing code structure.

> **Tips!** Before submitting your changes, run the following commands:

```bash
pnpm lint && pnpm format && pnpm knip && pnpm build
```

---

## Pull Request Guidelines

- **Follow the [PR Template](./PULL_REQUEST_TEMPLATE.md):**
  - Description
  - Types of changes
  - Checklist
  - Further comments
  - Related Issue
- Ensure your changes pass **CI checks**.
- Keep PRs **focused** and **concise**.
- Reference related issues in your PR description.

---

## Reporting Issues

- Clearly describe the issue.
- Provide reproduction steps if applicable.
- Include screenshots or code examples if relevant.

---

## Community Guidelines

- Be respectful and constructive.
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Stay on topic in discussions.

---

Thank you for helping make **shadcn-admin** better! 🚀

If you have any questions, feel free to reach out via [Discussions](https://github.com/satnaing/shadcn-admin/discussions).
