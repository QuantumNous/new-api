---
title: Table State (Svelte) Guide
---

## Table State (Svelte) Guide

TanStack Table has a simple underlying internal state management system to store and manage the state of the table. It also lets you selectively pull out any state that you need to manage in your own state management. This guide will walk you through the different ways in which you can interact with and manage the state of the table.

### Accessing Table State

You do not need to set up anything special in order for the table state to work. If you pass nothing into either `state`, `initialState`, or any of the `on[State]Change` table options, the table will manage its own state internally. You can access any part of this internal state by using the `table.getState()` table instance API.

```jsx
const options = writable({
  columns,
  data,
  //...
})

const table = createSvelteTable(options)

console.log(table.getState()) //access the entire internal state
console.log(table.getState().rowSelection) //access just the row selection state
```

### Custom Initial State

If all you need to do for certain states is customize their initial default values, you still do not need to manage any of the state yourself. You can simply set values in the `initialState` option of the table instance.

```jsx
const options = writable({
  columns,
  data,
  initialState: {
    columnOrder: ['age', 'firstName', 'lastName'], //customize the initial column order
    columnVisibility: {
      id: false //hide the id column by default
    },
    expanded: true, //expand all rows by default
    sorting: [
      {
        id: 'age',
        desc: true //sort by age in descending order by default
      }
    ]
  },
  //...
})

const table = createSvelteTable(options)
```

> **Note**: Only specify each particular state in either `initialState` or `state`, but not both. If you pass in a particular state value to both `initialState` and `state`, the initialized state in `state` will take overwrite any corresponding value in `initialState`.

### Controlled State

If you need easy access to the table state in other areas of your application, TanStack Table makes it easy to control and manage any or all of the table state in your own state management system. You can do this by passing in your own state and state management functions to the `state` and `on[State]Change` table options.

#### Individual Controlled State

You can control just the state that you need easy access to. You do NOT have to control all of the table state if you do not need to. It is recommended to only control the state that you need on a case-by-case basis.

In order to control a particular state, you need to both pass in the corresponding `state` value and the `on[State]Change` function to the table instance.

Let's take filtering, sorting, and pagination as an example in a "manual" server-side data fetching scenario. You can store the filtering, sorting, and pagination state in your own state management, but leave out any other state like column order, column visibility, etc. if your API does not care about those values.

```ts
let sorting = [
  {
    id: 'age',
    desc: true, //sort by age in descending order by default
  },
]
const setSorting = updater => {
  if (updater instanceof Function) {
    sorting = updater(sorting)
  } else {
    sorting = updater
  }
  options.update(old => ({
    ...old,
    state: {
      ...old.state,
      sorting,
    },
  }))
}

let columnFilters = [] //no default filters
const setColumnFilters = updater => {
  if (updater instanceof Function) {
    columnFilters = updater(columnFilters)
  } else {
    columnFilters = updater
  }
  options.update(old => ({
    ...old,
    state: {
      ...old.state,
      columnFilters,
    },
  }))
}

let pagination = { pageIndex: 0, pageSize: 15 } //default pagination
const setPagination = updater => {
  if (updater instanceof Function) {
    pagination = updater(pagination)
  } else {
    pagination = updater
  }
  options.update(old => ({
    ...old,
    state: {
      ...old.state,
      pagination,
    },
  }))
}

//Use our controlled state values to fetch data
const tableQuery = createQuery({
  queryKey: ['users', columnFilters, sorting, pagination],
  queryFn: () => fetchUsers(columnFilters, sorting, pagination),
  //...
})

const options = writable({
  columns,
  data: tableQuery.data,
  //...
  state: {
    columnFilters, //pass controlled state back to the table (overrides internal state)
    sorting,
    pagination
  },
  onColumnFiltersChange: setColumnFilters, //hoist columnFilters state into our own state management
  onSortingChange: setSorting,
  onPaginationChange: setPagination,
})

const table = createSvelteTable(options)
//...
```

#### Fully Controlled State

Alternatively, you can control the entire table state with the `onStateChange` table option. It will hoist out the entire table state into your own state management system. Be careful with this approach, as you might find that raising some frequently changing state values up a svelte tree, like `columnSizingInfo` state`, might cause bad performance issues.

A couple of more tricks may be needed to make this work. If you use the `onStateChange` table option, the initial values of the `state` must be populated with all of the relevant state values for all of the features that you want to use. You can either manually type out all of the initial state values, or use the `table.setOptions` API in a special way as shown below.

```jsx
//create a table instance with default state values
const options = writable({
  columns,
  data,
  //... Note: `state` values are NOT passed in yet
})
const table = createSvelteTable(options)

let state = {
  ...table.initialState, //populate the initial state with all of the default state values from the table instance
  pagination: {
    pageIndex: 0,
    pageSize: 15 //optionally customize the initial pagination state.
  }
}
const setState = updater => {
  if (updater instanceof Function) {
    state = updater(state)
  } else {
    state = updater
  }
  options.update(old => ({
    ...old,
    state,
  }))
}

//Use the table.setOptions API to merge our fully controlled state onto the table instance
table.setOptions(prev => ({
  ...prev, //preserve any other options that we have set up above
  state, //our fully controlled state overrides the internal state
  onStateChange: setState //any state changes will be pushed up to our own state management
}))
```

### On State Change Callbacks

So far, we have seen the `on[State]Change` and `onStateChange` table options work to "hoist" the table state changes into our own state management. However, there are a few things about these using these options that you should be aware of.

#### 1. **State Change Callbacks MUST have their corresponding state value in the `state` option**.

Specifying an `on[State]Change` callback tells the table instance that this will be a controlled state. If you do not specify the corresponding `state` value, that state will be "frozen" with its initial value.

```ts
let sorting = []
const setSorting = updater => {
  if (updater instanceof Function) {
    sorting = updater(sorting)
  } else {
    sorting = updater
  }
  options.update(old => ({
    ...old,
    state: {
      ...old.state,
      sorting,
    },
  }))
}
//...
const options = writable({
  columns,
  data,
  //...
  state: {
    sorting, //required because we are using `onSortingChange`
  },
  onSortingChange: setSorting, //makes the `state.sorting` controlled
})
const table = createSvelteTable(options)
```

#### 2. **Updaters can either be raw values or callback functions**.

The `on[State]Change` and `onStateChange` callbacks work exactly like the `setState` functions in React. The updater values can either be a new state value or a callback function that takes the previous state value and returns the new state value.

What implications does this have? It means that if you want to add in some extra logic in any of the `on[State]Change` callbacks, you can do so, but you need to check whether or not the new incoming updater value is a function or value.

This is why you see the `if (updater instanceof Function)` check in the `setState` functions in the examples above.

### State Types

All complex states in TanStack Table have their own TypeScript types that you can import and use. This can be handy for ensuring that you are using the correct data structures and properties for the state values that you are controlling.

```ts
import { createSvelteTable, type SortingState, type Updater } from '@tanstack/svelte-table'
//...
let sorting: SortingState[] = [
  {
    id: 'age', //you should get autocomplete for the `id` and `desc` properties
    desc: true,
  }
]
const setSorting = (updater: Updater<SortingState>)  => {
  if (updater instanceof Function) {
    sorting = updater(sorting)
  } else {
    sorting = updater
  }
  options.update(old => ({
    ...old,
    state: {
      ...old.state,
      sorting,
    },
  }))
}
```
