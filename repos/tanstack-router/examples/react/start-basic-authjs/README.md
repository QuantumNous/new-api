# TanStack Start - Auth.js Example

A TanStack Start example demonstrating authentication with Auth.js (NextAuth.js).

- [TanStack Router Docs](https://tanstack.com/router)
- [Auth.js Documentation](https://authjs.dev/)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/start-basic-authjs start-basic-authjs
```

## Setup

This example requires environment variables for Auth.js configuration. Copy the `.env.example` file to `.env` and fill in your authentication provider credentials:

```sh
cp .env.example .env
```

Edit `.env` and add your authentication provider credentials.

## Getting Started

From your terminal:

```sh
pnpm install
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Build

To build the app for production:

```sh
pnpm build
```

## Authentication Configuration

This example demonstrates how to integrate Auth.js with TanStack Start. Check the source code for examples of:

- Configuring authentication providers
- Protecting routes with authentication
- Accessing session data in server functions
