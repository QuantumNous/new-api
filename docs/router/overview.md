---
title: Overview
---

**TanStack Router is a router for building React and Solid applications**. Some of its features include:

- 100% inferred TypeScript support
- Typesafe navigation
- Nested Routing and layout routes (with pathless layouts)
- Built-in Route Loaders w/ SWR Caching
- Designed for client-side data caches (TanStack Query, SWR, etc.)
- Automatic route prefetching
- Asynchronous route elements and error boundaries
- File-based Route Generation
- Typesafe JSON-first Search Params state management APIs
- Path and Search Parameter Schema Validation
- Search Param Navigation APIs
- Custom Search Param parser/serializer support
- Search param middleware
- Route matching/loading middleware

To get started quickly, head to the next page. For a more lengthy explanation, buckle up while I bring you up to speed!

## "A Fork in the Route"

Using a router to build applications is widely regarded as a must-have and is usually one of the first choices you’ll make in your tech stack.

## Why TanStack Router?

TanStack Router delivers on the same fundamental expectations as other routers that you’ve come to expect:

- Nested routes, layout routes, grouped routes
- File-based Routing
- Parallel data loading
- Prefetching
- URL Path Params
- Error Boundaries and Handling
- SSR
- Route Masking

And it also delivers some new features that raise the bar:

- 100% inferred TypeScript support
- Typesafe navigation
- Built-in SWR Caching for loaders
- Designed for client-side data caches (TanStack Query, SWR, etc.)
- Typesafe JSON-first Search Params state management APIs
- Path and Search Parameter Schema Validation
- Search Parameter Navigation APIs
- Custom Search Param parser/serializer support
- Search param middleware
- Inherited Route Context
- Mixed file-based and code-based routing

Let’s dive into some of the more important ones in more detail!

## 100% Inferred TypeScript Support

Everything these days is written “in Typescript” or at the very least offers type definitions that are veneered over runtime functionality, but too few packages in the ecosystem actually design their APIs with TypeScript in mind. So while I’m pleased that your router is auto-completing your option fields and catching a few property/method typos here and there, there is much more to be had.

- TanStack Router is fully aware of all of your routes and their configuration at any given point in your code. This includes the path, path params, search params, context, and any other configuration you’ve provided. Ultimately this means that you can navigate to any route in your app with 100% type safety and confidence that your link or navigate call will succeed.
- TanStack Router provides lossless type-inference. It uses countless generic type parameters to enforce and propagate any type information you give it throughout the rest of its API and ultimately your app. No other router offers this level of type safety and developer confidence.

What does all of that mean for you?

- Faster feature development with auto-completion and type hints
- Safer and faster refactors
- Confidence that your code will work as expected

## 1st Class Search Parameters

Search parameters are often an afterthought, treated like a black box of strings (or string) that you can parse and update, but not much else. Existing solutions are **not** type-safe either, adding to the caution that is required to deal with them. Even the most "modern" frameworks and routers leave it up to you to figure out how to manage this state. Sometimes they'll parse the search string into an object for you, or sometimes you're left to do it yourself with `URLSearchParams`.

Let's step back and remember that **search params are the most powerful state manager in your entire application.** They are global, serializable, bookmarkable, and shareable making them the perfect place to store any kind of state that needs to survive a page refresh or a social share.

To live up to that responsibility, search parameters are a first-class citizen in TanStack Router. While still based on standard URLSearchParams, TanStack Router uses a powerful parser/serializer to manage deeper and more complex data structures in your search params, all while keeping them type-safe and easy to work with.

**It's like having `useState` right in the URL!**

Search parameters are:

- Automatically parsed and serialized as JSON
- Validated and typed
- Inherited from parent routes
- Accessible in loaders, components, and hooks
- Easily modified with the useSearch hook, Link, navigate, and router.navigate APIs
- Customizable with a custom search filters and middleware
- Subscribed via fine-grained search param selectors for efficient re-renders

Once you start using TanStack Router's search parameters, you'll wonder how you ever lived without them.

## Built-In Caching and Friendly Data Loading

Data loading is a critical part of any application and while most existing routers offer some form of critical data loading APIs, they often fall short when it comes to caching and data lifecycle management. Existing solutions suffer from a few common problems:

- No caching at all. Data is always fresh, but your users are left waiting for frequently accessed data to load over and over again.
- Overly-aggressive caching. Data is cached for too long, leading to stale data and a poor user experience.
- Blunt invalidation strategies and APIs. Data may be invalidated too often, leading to unnecessary network requests and wasted resources, or you may not have any fine-grained control over when data is invalidated at all.

TanStack Router solves these problems with a two-prong approach to caching and data loading:

### Built-in Cache

TanStack Router provides a light-weight built-in caching layer that works seamlessly with the Router. This caching layer is loosely based on TanStack Query, but with fewer features and a much smaller API surface area. Like TanStack Query, sane but powerful defaults guarantee that your data is cached for reuse, invalidated when necessary, and garbage collected when not in use. It also provides a simple API for invalidating the cache manually when needed.

### Flexible & Powerful Data Lifecycle APIs

TanStack Router is designed with a flexible and powerful data loading API that more easily integrates with existing data fetching libraries like TanStack Query, SWR, Apollo, Relay, or even your own custom data fetching solution. Configurable APIs like `context`, `beforeLoad`, `loaderDeps` and `loader` work in unison to make it easy to define declarative data dependencies, prefetch data, and manage the lifecycle of an external data source with ease.

## Inherited Route Context

TanStack Router's router and route context is a powerful feature that allows you to define context that is specific to a route which is then inherited by all child routes. Even the router and root routes themselves can provide context. Context can be built up both synchronously and asynchronously, and can be used to share data, configuration, or even functions between routes and route configurations. This is especially useful for scenarios like:

- Authentication and Authorization
- Hybrid SSR/CSR data fetching and preloading
- Theming
- Singletons and global utilities
- Curried or partial application across preloading, loading, and rendering stages

Also, what would route context be if it weren't type-safe? TanStack Router's route context is fully type-safe and inferred at zero cost to you.

## File-based and/or Code-Based Routing

TanStack Router supports both file-based and code-based routing at the same time. This flexibility allows you to choose the approach that best fits your project's needs.

TanStack Router's file-based routing approach is uniquely user-facing. Route configuration is generated for you either by the Vite plugin or TanStack Router CLI, leaving the usage of said generated code up to you! This means that you're always in total control of your routes and router, even if you use file-based routing.

## Acknowledgements

TanStack Router builds on concepts and patterns popularized by many other OSS projects, including:

- [TRPC](https://trpc.io/)
- [Remix](https://remix.run)
- [Chicane](https://swan-io.github.io/chicane/)
- [Next.js](https://nextjs.org)

We acknowledge the investment, risk and research that went into their development, but are excited to push the bar they have set even higher.

## Let's go!

Enough overview, there's so much more to do with TanStack Router. Hit that next button and let's get started!
