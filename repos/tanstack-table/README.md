![TanStack Table Header](https://github.com/tanstack/table/raw/main/media/repo-header.png)

# [TanStack](https://tanstack.com) Table v8

Headless UI for building **powerful tables & datagrids** for **React, Solid, Vue, Svelte, Qwik and TS/JS**.

<a href="https://twitter.com/intent/tweet?button_hashtag=TanStack" target="\_parent">
  <img alt="#TanStack" src="https://img.shields.io/twitter/url?color=%2308a0e9&label=%23TanStack&style=social&url=https%3A%2F%2Ftwitter.com%2Fintent%2Ftweet%3Fbutton_hashtag%3DTanStack" />
</a>
<a href="https://github.com/tanstack/table/actions?table=workflow%3A%22react-table+tests%22">
  <img src="https://github.com/tanstack/table/workflows/react-table%20tests/badge.svg" />
</a>
<a href="https://npmjs.com/package/@tanstack/react-table" target="\_parent">
  <img alt="" src="https://img.shields.io/npm/dm/@tanstack/react-table.svg" />
</a>
<a href="https://bundlephobia.com/result?p=@tanstack/react-table@latest" target="\_parent">
  <img alt="" src="https://badgen.net/bundlephobia/minzip/@tanstack/react-table@latest" />
</a>
<a href="#badge">
  <img alt="semantic-release" src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg">
</a>
<a href="https://github.com/tanstack/table/discussions">
  <img alt="Join the discussion on Github" src="https://img.shields.io/badge/Github%20Discussions%20%26%20Support-Chat%20now!-blue" />
</a>
<a href="https://github.com/tanstack/table" target="\_parent">
  <img alt="" src="https://img.shields.io/github/stars/tanstack/react-table.svg?style=social&label=Star" />
</a>
<a href="https://twitter.com/tannerlinsley" target="\_parent">
  <img alt="" src="https://img.shields.io/twitter/follow/tannerlinsley.svg?style=social&label=Follow" />
</a>

> [Looking for version 7 of `react-table`? Click here!](https://github.com/tanstack/table/tree/v7)

## Enjoy this library?

Try other [TanStack](https://tanstack.com) libraries:

- [TanStack Query](https://github.com/TanStack/query) <img alt="" src="https://img.shields.io/github/stars/tanstack/query.svg" />
- [TanStack Table](https://github.com/TanStack/table) <img alt="" src="https://img.shields.io/github/stars/tanstack/table.svg" />
- [TanStack Router](https://github.com/TanStack/router) <img alt="" src="https://img.shields.io/github/stars/tanstack/router.svg" />
- [TanStack Virtual](https://github.com/TanStack/virtual) <img alt="" src="https://img.shields.io/github/stars/tanstack/virtual.svg" />
- [TanStack Form](https://github.com/TanStack/form) <img alt="" src="https://img.shields.io/github/stars/tanstack/form.svg" />
- [TanStack Ranger](https://github.com/TanStack/ranger) <img alt="" src="https://img.shields.io/github/stars/tanstack/ranger.svg" />

## Visit [tanstack.com/table](https://tanstack.com/table) for docs, guides, API and more!

You may know **TanStack Table** by our adapter names, too!

- [Angular Table](https://tanstack.com/table/v8/docs/framework/angular/angular-table)
- [Lit Table](https://tanstack.com/table/v8/docs/framework/lit/lit-table)
- [Qwik Table](https://tanstack.com/table/v8/docs/framework/qwik/qwik-table)
- [**React Table**](https://tanstack.com/table/v8/docs/framework/react/react-table)
- [Solid Table](https://tanstack.com/table/v8/docs/framework/solid/solid-table)
- [Svelte Table](https://tanstack.com/table/v8/docs/framework/svelte/svelte-table)
- [Vue Table](https://tanstack.com/table/v8/docs/framework/vue/vue-table)

## Summary

TanStack Table is a **headless** table library, which means it does not ship with components, markup or styles. This means that you have **full control** over markup and styles (CSS, CSS-in-JS, UI Component Libraries, etc) and this is also what gives it its portable nature. You can even use it in React Native!

If you want a **lightweight table with full control over markup and implementation**, then you should consider using **TanStack Table, a headless table library**.

If you want a **ready-to-use component-based table with more power but more constraints around markup/styles/implementation**, you should consider using [AG Grid](https://ag-grid.com/react-data-grid/?utm_source=reacttable&utm_campaign=githubreacttable), a component-based table library from our OSS partner [AG Grid](https://ag-grid.com).

TanStack Table and AG Grid are respectfully the
**best table/datagrid libraries around**. Instead
of competing, we're working together to ensure the highest
quality table/datagrid options are available for the entire
JS/TS ecosystem and every use-case.

## Quick Features

- Agnostic core (JS/TS)
- 1st-class framework bindings for React, Vue, Solid
- ~15kb or less (with tree-shaking)
- 100% TypeScript (but not required)
- Headless (100% customizable, Bring-your-own-UI)
- Auto out of the box, opt-in controllable state
- Filters (column and global)
- Sorting (multi-column, multi-directional)
- Grouping & Aggregation
- Pivoting (coming soon!)
- Row Selection
- Row Expansion
- Column Visibility/Ordering/Pinning/Resizing
- Table Splitting
- Animatable
- Virtualizable
- Server-side/external data model support

# Migrating from React Table v7

## Notable Changes

- Full rewrite to TypeScript with types included in the base package
- Removal of plugin system to favor more inversion of control
- Vastly larger and improved API (and new features like pinning)
- Better controlled state management
- Better support for server-side operations
- Complete (but optional) data pipeline control
- Agnostic core with framework adapters for React, Solid, Svelte, Vue, and potentially more in the future
- New Dev Tools

## Migration

There are a fair amount of breaking changes (they're worth it, trust us!):

- Turns out that TypeScript makes your code **a lot** better/safer, but also usually requires breaking changes to architecture.
- Plugin system has been removed so plugins must be rewritten to wrap/compose the new functional API. Contact us if you need help!
- Column configuration options have changed, but only slightly.
- Table options are mostly the same, with some larger changes around optional state management/control and data pipeline control
- The `table` instance while similar in spirit to v7 has been reconfigured to be much faster.

## Installation

Install one of the following packages based on your framework of choice:

```bash
# Npm
npm install @tanstack/angular-table
npm install @tanstack/lit-table
npm install @tanstack/qwik-table
npm install @tanstack/react-table
npm install @tanstack/solid-table
npm install @tanstack/svelte-table
npm install @tanstack/vue-table
npm install @tanstack/table-core #vanilla js that can work with any framework
```

## How to help?

- Try out the already-migrated examples
- Try it out in your own projects.
- Introspect the types! Even without the docs finished, the library ships with 100% typescript to help you explore its capabilities.
- [Read the contribution guidelines](https://github.com/tanstack/table/tree/main/CONTRIBUTING.md)
- Write some docs! Start with the [API docs](https://github.com/TanStack/react-table/tree/main/docs/api) and try adding some information about one or more of the features. The types do a decent job of showing what's supported and the capabilities of the library.
- **Using a plugin?** Try rewriting your plugin (v8 doesn't have a plugin system any more) as a functional wrapper that uses TanStack Table internally. The new API is much more powerful and easier to compose. If you find something you can't figure out, let us know and we'll add it to the API.

### [Become a Sponsor](https://github.com/sponsors/tannerlinsley/)

<!-- USE THE FORCE LUKE -->
