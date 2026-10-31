---
id: databases
title: Databases
---

Databases are at the core of any dynamic application, providing the necessary infrastructure to store, retrieve, and manage data. TanStack Start makes it easy to integrate with a variety of databases, offering a flexible approach to managing your application's data layer.

## What should I use?

TanStack Start is **designed to work with any database provider**, so if you already have a preferred database system, you can integrate it with TanStack Start using the provided full-stack APIs. Whether you're working with SQL, NoSQL, or other types of databases, TanStack Start can handle your needs.

## How simple is it to use a database with TanStack Start?

Using a database with TanStack Start is as simple as calling into your database's adapter/client/driver/service from a TanStack Start server function or server route.

Here's an abstract example of how you might connect with a database and read/write to it:

```tsx
import { createServerFn } from '@tanstack/react-start'

const db = createMyDatabaseClient()

export const getUser = createServerFn().handler(async ({ context }) => {
  const user = await db.getUser(context.userId)
  return user
})

export const createUser = createServerFn({ method: 'POST' }).handler(
  async ({ data }) => {
    const user = await db.createUser(data)
    return user
  },
)
```

This is obviously contrived, but it demonstrates that you can use literally any database provider with TanStack Start as long as you can call into it from a server function or server route.

## Recommended Database Providers

While TanStack Start is designed to work with any database provider, we highly recommend considering one of our vetted partner database providers [Neon](https://neon.tech?utm_source=tanstack) or [Convex](https://convex.dev?utm_source=tanstack). They have been vetted by TanStack to match our quality, openness, and performance standards and are both excellent choices for your database needs.

## What is Neon?

<a href="https://neon.tech?utm_source=tanstack" alt="Neon Logo">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/neon-dark.svg" width="280">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/neon-light.svg" width="280">
    <img alt="Neon logo" src="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/neon-light.svg" width="280">
  </picture>
</a>

Neon is a fully managed serverless PostgreSQL with a generous free tier. It separates storage and compute to offer autoscaling, branching, and bottomless storage. With Neon, you get all the power and reliability of PostgreSQL combined with modern cloud capabilities, making it perfect for TanStack Start applications.

Key features that make Neon stand out:

- Serverless PostgreSQL that scales automatically
- Database branching for development and testing
- Built-in connection pooling
- Point-in-time restore
- Web-based SQL editor
- Bottomless storage
  <br />
  <br />
- To learn more about Neon, visit the [Neon website](https://neon.tech?utm_source=tanstack)
- To sign up, visit the [Neon dashboard](https://console.neon.tech/signup?utm_source=tanstack)

## What is Convex?

<a href="https://convex.dev?utm_source=tanstack" alt="Convex Logo">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/convex-white.svg" width="280">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/convex-color.svg" width="280">
    <img alt="Convex logo" src="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/convex-color.svg" width="280">
  </picture>
</a>

Convex is a powerful, serverless database platform that simplifies the process of managing your application's data. With Convex, you can build full-stack applications without the need to manually manage database servers or write complex queries. Convex provides a real-time, scalable, and transactional data backend that seamlessly integrates with TanStack Start, making it an excellent choice for modern web applications.

Convex's declarative data model and automatic conflict resolution ensure that your application remains consistent and responsive, even at scale. It's designed to be developer-friendly, with a focus on simplicity and productivity.

- To learn more about Convex, visit the [Convex website](https://convex.dev?utm_source=tanstack)
- To sign up, visit the [Convex dashboard](https://dashboard.convex.dev/signup?utm_source=tanstack)

## What is Prisma Postgres?

<a href="https://www.prisma.io?utm_source=tanstack&via=tanstack" alt="Prisma Logo">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/prisma-dark.svg" width="280">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/prisma-light.svg" width="280">
    <img alt="Prisma logo" src="https://raw.githubusercontent.com/tanstack/tanstack.com/main/src/images/prisma-light.svg" width="280">
  </picture>
</a>

Instant Postgres, Zero Setup: Get a production-ready Postgres database in seconds, then dive straight back into code. We handle connections, scaling, and turning knobs so your flow never breaks. Blends perfectly with TanStack Start.

- Edge-optimized: Local region routing means lower latency and fewer hops. Even complex queries are one fast round trip.
- Fits your stack: Works with your frameworks, libraries, and tools for a smooth DX.
- Web UI: A hosted interface to inspect, manage, and query data with your team.
- Auto-scaling: Grows from zero to millions of users without cold starts or manual tuning.
- Unikernel isolation: Each DB runs as its own unikernel for security, speed, and efficiency.
  <br />
  <br />
- To learn more about Prisma Postgres, visit the [Prisma website](https://www.prisma.io?utm_source=tanstack&via=tanstack)
- To sign up, visit the [Prisma Console](https://console.prisma.io/sign-up?utm_source=tanstack&via=tanstack)

## Documentation & APIs

Documentation for integrating different databases with TanStack Start is coming soon! In the meantime, keep an eye on our examples and guide to learn how to fully leverage your data layer across your TanStack Start application.
