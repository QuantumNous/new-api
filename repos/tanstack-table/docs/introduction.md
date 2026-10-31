---
title: Introduction
---

TanStack Table is a **Headless UI** library for building powerful tables & datagrids for TS/JS, React, Vue, Solid, Qwik, and Svelte.

## What is "headless" UI?

**Headless UI** is a term for libraries and utilities that provide the logic, state, processing and API for UI elements and interactions, but **do not provide markup, styles, or pre-built implementations**. Scratching your head yet? 😉 Headless UI has a few main goals:

The hardest parts of building complex UIs usually revolve around state, events, side-effects, data computation/management. By removing these concerns from the markup, styles and implementation details, our logic and components can be more modular and reusable.

Building UI is a very branded and custom experience, even if that means choosing a design system or adhering to a design spec. To support this custom experience, component-based UI libraries need to support a massive (and seemingly endless) API surface around markup and style customization. Headless UI libraries decouple your logic from your UI

When you use a headless UI library, the complex task of **data-processing, state-management, and business logic** are handled for you, leaving you to worry about higher-cardinality decisions that differ across implementations and use cases.

> Want to dive deeper? [Read more about Headless UI](https://www.merrickchristensen.com/articles/headless-user-interface-components/).

## Component-based libraries vs Headless libraries

In the ecosystem of table/datagrid libraries, there are two main categories:

- Component-based table libraries
- Headless table libraries

### Which kind of table library should I use?

Each approach has subtle tradeoffs. Understanding these subtleties will help you make the right decision for your application and team.

### Component-based Table Libraries

Component-based table libraries will typically supply you with a feature-rich drop-in solution and ready-to-use components/markup complete with styles/theming. [AG Grid](https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable) is a great example of this type of table library.

**Pros:**

- Ship with ready-to-use markup/styles
- Little setup required
- Turn-key experience

**Cons:**

- Less control over markup
- Custom styles are typically theme-based
- Larger bundle-sizes
- Highly coupled to framework adapters and platforms

**If you want a ready-to-use table and design/bundle-size are not hard requirements**, then you should consider using a component-based table library.

There are a lot of component-based table libraries out there, but we believe [AG Grid](https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable) is the gold standard and is by far our favorite grid-sibling (don't tell the others 🤫).

### Headless Table Libraries

Headless table libraries will typically supply you with functions, state, utilities and event listeners to build your own table markup or attach to existing table markups.

**Pros:**

- Full control over markup and styles
- Supports all styling patterns (CSS, CSS-in-JS, UI libraries, etc)
- Smaller bundle-sizes
- Portable. Run anywhere JS runs!

**Cons:**

- More setup required
- No markup, styles or themes provided

**If you want a lighter-weight table or full control over the design**, then you should consider using a headless table library.

There are very few headless table libraries out there and obviously, **TanStack Table** is our favorite!
