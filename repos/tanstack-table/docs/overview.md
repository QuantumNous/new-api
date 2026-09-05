---
title: Overview
---

TanStack Table's core is **framework agnostic**, which means its API is the same regardless of the framework you're using. Adapters are provided to make working with the table core easier depending on your framework. See the Adapters menu for available adapters.

## Typescript

While TanStack Table is written in [TypeScript](https://www.typescriptlang.org/), using TypeScript in your application is optional (but recommended as it comes with outstanding benefits to both you and your codebase)

If you use TypeScript, you will get top-notch type safety and editor autocomplete for all table APIs and state.

## Headless

As it was mentioned extensively in the [Intro](../introduction) section, TanStack Table is **headless**. This means that it doesn't render any DOM elements, and instead relies on you, the UI/UX developer to provide the table's markup and styles. This is a great way to build a table that can be used in any UI framework, including React, Vue, Solid, Svelte, Qwik, Angular, and even JS-to-native platforms like React Native!

## Agnostic

Since TanStack Table is headless and runs on a vanilla JavaScript core, it is agnostic in a couple of ways:

1. TanStack Table is **Framework Agnostic**, which means you can use it with any JavaScript framework (or library) that you want. TanStack Table provides ready-to-use adapters for React, Vue, Solid, Svelte, and Qwik out of the box, but you can create your own adapter if you need to.
2. TanStack Table is **CSS / Component Library Agnostic**, which means that you can use TanStack Table with whatever CSS strategy or component library you want. TanStack Table itself does not render any table markup or styles. You bring your own! Want to use Tailwind or ShadCN? No problem! Want to use Material UI or Bootstrap? No problem! Have your own custom design system? TanStack Table was made for you!

## Core Objects and Types

The table core uses the following abstractions, commonly exposed by adapters:

- [Data](../guide/data) - The core data array you provide the table
- [Column Defs](../guide/column-defs): Objects used to configure a column and its data model, display templates, and more
- [Table Instance](../guide/tables): The core table object containing both state and API
- [Row Models](../guide/row-models): How the `data` array is transformed into useful rows depending on the features you are using
- [Rows](../guide/rows): Each row mirrors its respective row data and provides row-specific APIs
- [Cells](../guide/cells): Each cell mirrors its respective row-column intersection and provides cell-specific APIs
- [Header Groups](../guide/header-groups):  Header groups are computed slices of nested header levels, each containing a group of headers
- [Headers](../guide/headers): Each header is either directly associated with or derived from its column def and provides header-specific APIs
- [Columns](../guide/columns): Each column mirrors its respective column def and also provides column-specific APIs

## Features

TanStack Table will help you build just about any type of table you can imagine. It has built-in state and APIs for the following features:

- [Column Faceting](../guide/column-faceting) - List unique lists of column values or min/max values for a column
- [Column Filtering](../guide/column-filtering) - Filter rows based on search values for a column
- [Column Grouping](../guide/grouping) - Group columns together, run aggregations, and more
- [Column Ordering](../guide/column-ordering) - Dynamically change the order of columns
- [Column Pinning](../guide/column-pinning) - Pin (Freeze) columns to the left or right of the table
- [Column Sizing](../guide/column-sizing) - Dynamically change the size of columns (column resizing handles)
- [Column Visibility](../guide/column-visibility) - Hide/show columns
- [Global Faceting](../guide/global-faceting) - List unique lists of column values or min/max values for the entire table
- [Global Filtering](../guide/global-filtering) - Filter rows based on search values for the entire table
- [Row Expanding](../guide/expanding) - Expand/collapse rows (sub-rows)
- [Row Pagination](../guide/pagination) - Paginate rows
- [Row Pinning](../guide/row-pinning) - Pin (Freeze) rows to the top or bottom of the table
- [Row Selection](../guide/row-selection) - Select/deselect rows (checkboxes)
- [Row Sorting](../guide/sorting) - Sort rows by column values

These are just some of the capabilities that you can build with TanStack Table. There are many more features that are possible with TanStack Table that you can add along-side the built-in features.

[Virtualization](../guide/virtualization) is an example of a feature that is not built-in to TanStack Table, but can be achieved by using another library (like [TanStack Virtual](https://tanstack.com/virtual/v3)) and adding it along-side your other table rendering logic.

TanStack Table also supports [Custom Features](../guide/custom-features) (plugins) that you can use to modify the table instance to add your own custom logic to the table in a more integrated way.

And of course, you can just write your own state and hooks to add whatever other features you want for your table. The features from the TanStack Table core are just a solid foundation to build on, with a large focus on performance and DX.
