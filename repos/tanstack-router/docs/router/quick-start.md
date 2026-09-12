---
id: quick-start
title: Quick Start
---

## Impatient?

The fastest way to get started with TanStack Router is to scaffold a new project. Just run:

<!-- ::start:tabs variant="package-managers" mode="local-install" -->

react: @tanstack/cli create --router-only
solid: @tanstack/cli create --router-only --framework solid

<!-- ::end:tabs -->

The CLI will guide you through a short series of prompts to customize your setup, including options for:

- File-based or code-based route configuration
- TypeScript support
- Tailwind CSS integration
- Toolchain setup
- Git initialization

Once complete, a new project will be generated with TanStack Router installed and ready to use.

> [!TIP]
> For full details on available options and templates, visit the [`@tanstack/cli` documentation](https://github.com/TanStack/cli).

## Routing Options

TanStack Router supports both file-based and code-based route configurations. You can specify your preference during the CLI setup, or use these commands directly:

### File-Based Route Generation

The file-based approach is the recommended option for most projects. It automatically creates routes based on your file structure, giving you the best mix of performance, simplicity, and developer experience.

For more details, see the [file-based routing documentation](./routing/file-based-routing.md) or

<!-- ::start:framework -->

# React

[explore the live example](https://tanstack.com/router/latest/docs/framework/react/examples/basic-file-based)

# Solid

[explore the live example](https://tanstack.com/router/latest/docs/framework/solid/examples/basic-file-based)

<!-- ::end:framework -->

### Code-Based Route Configuration

If you prefer to define routes programmatically, you can use the code-based route configuration. This approach gives you full control over routing logic.

For more details, see the [code-based routing documentation](./routing/code-based-routing.md) or

<!-- ::start:framework -->

# React

[explore the live example](https://tanstack.com/router/latest/docs/framework/react/examples/basic)

# Solid

[explore the live example](https://tanstack.com/router/latest/docs/framework/solid/examples/basic)

<!-- ::end:framework -->

With either approach, navigate to your project directory and start the development server.

## Existing Project

If you have an existing React project and want to add TanStack Router to it, you can install it manually.

### Requirements

Before installing TanStack Router, please ensure your project meets the following requirements:

<!-- ::start:framework -->

# React

- `react` v18 or later with `createRoot` support.
- `react-dom` v18 or later.

# Solid

- `solid-js` v1.x.x

<!-- ::end:framework -->

> [!NOTE]
> Using TypeScript (`v5.3.x or higher`) is recommended for the best development experience, though not strictly required. We aim to support the last 5 minor versions of TypeScript, but using the latest version will help avoid potential issues.

TanStack Router is currently only compatible with React (with ReactDOM) and Solid. If you're interested in contributing to support other frameworks, such as React Native, Angular, or Vue, please reach out to us on [Discord](https://tlinz.com/discord).

### Installation

To install TanStack Router in your project, run the following command using your preferred package manager:

<!-- ::start:tabs variant="package-managers" -->

react: @tanstack/react-router
solid: @tanstack/solid-router

<!-- ::end:tabs -->

Once installed, you can verify the installation by checking your `package.json` file for the dependency.

<!-- ::start:framework -->

# React

```json
{
  "dependencies": {
    "@tanstack/react-router": "^x.x.x"
  }
}
```

# Solid

```json
{
  "dependencies": {
    "@tanstack/solid-router": "^x.x.x"
  }
}
```

<!-- ::end:framework -->
