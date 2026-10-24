---
id: overview
title: TanStack Start Overview
---

> [!NOTE]
> TanStack Start is currently in the **Release Candidate** stage! This means it is considered feature-complete and its API is considered stable.
> **This does not mean it is bug-free or without issues, which is why we invite you to try it out and provide feedback!**
> The road to v1 will likely be a quick one, so don't wait too long to try it out!

TanStack Start is a full-stack React framework powered by TanStack Router. It provides a full-document SSR, streaming, server functions, client/server builds, and more. With [Vite](https://vite.dev/) and [Rsbuild](https://rsbuild.dev/) support, it's ready to develop and deploy to the hosting provider or runtime you want.

## Dependencies

TanStack Start is built on two key technologies:

- **[TanStack Router](https://tanstack.com/router)**: A type-safe router for building web applications with advanced features like nested routing, search params, and data loading
- **[Vite](https://vite.dev/) or [Rsbuild](https://rsbuild.dev/)**: Modern build tools that provide fast development with hot module replacement and optimized production builds

## Should I use TanStack Start or just TanStack Router?

90% of any framework usually comes down to the router, and TanStack Start is no different. **TanStack Start relies 100% on TanStack Router for its routing system.** In addition to TanStack Router's amazing features, Start enables even more powerful features:

- **Full-document SSR** - Server-side rendering for better performance and SEO
- **Streaming** - Progressive page loading for improved user experience
- **Server Routes & API Routes** - Build backend endpoints alongside your frontend
- **Server Functions** - Type-safe RPCs between client and server
- **Middleware & Context** - Powerful request/response handling and data injection
- **Full-Stack Builds** - Optimized builds for both client and server code
- **Universal Deployment** - Deploy to hosting providers and runtimes with Vite or Rsbuild builds
- **End-to-End Type Safety** - Full TypeScript support across the entire stack

That said, if you **know with certainty** that you will not need any of the above features, then you may want to consider using TanStack Router alone, which is still a powerful and type-safe SPA routing upgrade over other routers and frameworks.

## Are there limitations?

TanStack Start provides the same capability as other full-stack frameworks like Next.js, Remix, etc, with even more features and a more powerful developer experience. React Server Components are available as an experimental feature - see the [Server Components guide](./guide/server-components.md) for details.

## How is TanStack Start funded?

TanStack is 100% open source, free to use, and always will be. It is built and maintained by an extremely talented and dedicated community of developers and software engineers. TanStack.com (also open source) is owned by TanStack LLC, a privately held company, 100% bootstrapped and self-funded. We are not venture-backed and have never sought investors. To support the development of TanStack Start and other TanStack libraries, TanStack.com partners with [these amazing companies](https://tanstack.com/partners?status=active&libraries=%5B%22start%22%5D) who offer both financial support and resources to help us continue to build the best possible developer experience for the web community:

<iframe src="https://tanstack.com/partners-embed" style="aspect-ratio: 1/2; width: 100%;"></iframe>

## Ready to get started?

Go to the next page to learn how to install TanStack Start and create your first app!
