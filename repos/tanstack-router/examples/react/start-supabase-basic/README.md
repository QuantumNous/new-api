# TanStack Start - Supabase Example

A TanStack Start example demonstrating integration with Supabase for authentication and database.

- [TanStack Router Docs](https://tanstack.com/router)
- [Supabase Documentation](https://supabase.com/docs)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/start-supabase-basic start-supabase-basic
```

## Setup

This example requires Supabase configuration. The `.env` file contains the necessary environment variables:

```env
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
```

You'll need to:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from the project settings
3. Update the `.env` file with your credentials

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

## Supabase Integration

This example demonstrates:

- Authentication with Supabase Auth
- Database queries with Supabase client
- Real-time subscriptions
- Server-side data fetching
