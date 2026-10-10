---
title: Table State (Angular) Guide
---

## Table State (Angular) Guide

TanStack Table has a simple underlying internal state management system to store and manage the state of the table. It also lets you selectively pull out any state that you need to manage in your own state management. This guide will walk you through the different ways in which you can interact with and manage the state of the table.

### Accessing Table State

You do not need to set up anything special in order for the table state to work. If you pass nothing into either `state`, `initialState`, or any of the `on[State]Change` table options, the table will manage its own state internally. You can access any part of this internal state by using the `table.getState()` table instance API.

```ts
table = createAngularTable(() => ({
  columns: this.columns,
  data: this.data(),
  //...
}))

someHandler() {
  console.log(this.table.getState()) //access the entire internal state
  console.log(this.table.getState().rowSelection) //access just the row selection state
}
```

### Custom Initial State

If all you need to do for certain states is customize their initial default values, you still do not need to manage any of the state yourself. You can simply set values in the `initialState` option of the table instance.

```jsx
table = createAngularTable(() => ({
  columns: this.columns,
  data: this.data(),
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
}))
```

> **Note**: Only specify each particular state in either `initialState` or `state`, but not both. If you pass in a particular state value to both `initialState` and `state`, the initialized state in `state` will take overwrite any corresponding value in `initialState`.

### Controlled State

If you need easy access to the table state in other areas of your application, TanStack Table makes it easy to control and manage any or all of the table state in your own state management system. You can do this by passing in your own state and state management functions to the `state` and `on[State]Change` table options.

#### Individual Controlled State

You can control just the state that you need easy access to. You do NOT have to control all of the table state if you do not need to. It is recommended to only control the state that you need on a case-by-case basis.

In order to control a particular state, you need to both pass in the corresponding `state` value and the `on[State]Change` function to the table instance.

Let's take filtering, sorting, and pagination as an example in a "manual" server-side data fetching scenario. You can store the filtering, sorting, and pagination state in your own state management, but leave out any other state like column order, column visibility, etc. if your API does not care about those values.

```ts
import {signal} from '@angular/core';
import {SortingState, ColumnFiltersState, PaginationState} from '@tanstack/angular-table'
import {toObservable} from "@angular/core/rxjs-interop";
import {combineLatest, switchMap} from 'rxjs';

class TableComponent {
  readonly columnFilters = signal<ColumnFiltersState>([]) //no default filters
  readonly sorting = signal<SortingState>([
    {
      id: 'age',
      desc: true, //sort by age in descending order by default
    }
  ])
  readonly pagination = signal<PaginationState>({
    pageIndex: 0,
    pageSize: 15
  })

  //Use our controlled state values to fetch data
  readonly data$ = combineLatest({
    filters: toObservable(this.columnFilters),
    sorting: toObservable(this.sorting),
    pagination: toObservable(this.pagination)
  }).pipe(
    switchMap(({filters, sorting, pagination}) => fetchData(filters, sorting, pagination))
  )
  readonly data = toSignal(this.data$);

  readonly table = createAngularTable(() => ({
    columns: this.columns,
    data: this.data(),
    //...
    state: {
      columnFilters: this.columnFilters(), //pass controlled state back to the table (overrides internal state)
      sorting: this.sorting(),
      pagination: this.pagination(),
    },
    onColumnFiltersChange: updater => { //hoist columnFilters state into our own state management
      updater instanceof Function
        ? this.columnFilters.update(updater)
        : this.columnFilters.set(updater)
    },
    onSortingChange: updater => {
      updater instanceof Function
        ? this.sorting.update(updater)
        : this.sorting.set(updater)
    },
    onPaginationChange: updater => {
      updater instanceof Function
        ? this.pagination.update(updater)
        : this.pagination.set(updater)
    },
  }))
}

//...
```

#### Fully Controlled State

Alternatively, you can control the entire table state with the `onStateChange` table option. It will hoist out the entire table state into your own state management system. Be careful with this approach, as you might find that raising some frequently changing state values up a component tree, like `columnSizingInfo` state`, might cause bad performance issues.

A couple of more tricks may be needed to make this work. If you use the `onStateChange` table option, the initial values of the `state` must be populated with all of the relevant state values for all of the features that you want to use. You can either manually type out all of the initial state values, or use a constructor in a special way as shown below.

```ts


class TableComponent {
  // create an empty table state, we'll override it later
  readonly state = signal({} as TableState);

  // create a table instance with default state values
  readonly table = createAngularTable(() => ({
    columns: this.columns,
    data: this.data(),
    // our fully controlled state overrides the internal state
    state: this.state(),
    onStateChange: updater => {
      // any state changes will be pushed up to our own state management
      this.state.set(
        updater instanceof Function ? updater(this.state()) : updater
      )
    }
  }))

  constructor() {
    // set the initial table state
    this.state.set({
      // populate the initial state with all of the default state values
      // from the table instance
      ...this.table.initialState,
      pagination: {
        pageIndex: 0,
        pageSize: 15, // optionally customize the initial pagination state.
      },
    })
  }
}
```

### On State Change Callbacks

So far, we have seen the `on[State]Change` and `onStateChange` table options work to "hoist" the table state changes into our own state management. However, there are a few things about these using these options that you should be aware of.

#### 1. **State Change Callbacks MUST have their corresponding state value in the `state` option**.

Specifying an `on[State]Change` callback tells the table instance that this will be a controlled state. If you do not specify the corresponding `state` value, that state will be "frozen" with its initial value.

```ts
class TableComponent {
  sorting = signal<SortingState>([])

  table = createAngularTable(() => ({
    columns: this.columns,
    data: this.data(),
    //...
    state: {
      sorting: this.sorting(), // required because we are using `onSortingChange`
    },
    onSortingChange: updater => { // makes the `state.sorting` controlled
      updater instanceof Function
        ? this.sorting.update(updater)
        : this.sorting.set(updater)
    }
  }))
}
```

#### 2. **Updaters can either be raw values or callback functions**.

The `on[State]Change` and `onStateChange` callbacks work exactly like the `setState` functions in React. The updater values can either be a new state value or a callback function that takes the previous state value and returns the new state value.

What implications does this have? It means that if you want to add in some extra logic in any of the `on[State]Change` callbacks, you can do so, but you need to check whether or not the new incoming updater value is a function or value.

This is why you will see the `updater instanceof Function ? this.state.update(updater) : this.state.set(updater)` pattern in the examples above. This pattern checks if the updater is a function, and if it is, it calls the function with the previous state value to get the new state value, or the signal will require `signal.update` to be called with the updater instead of `signal.set`.

### State Types

All complex states in TanStack Table have their own TypeScript types that you can import and use. This can be handy for ensuring that you are using the correct data structures and properties for the state values that you are controlling.

```ts
import {createAngularTable, type SortingState} from '@tanstack/angular-table'

class TableComponent {
  readonly sorting = signal<SortingState>([
    {
      id: 'age', // you should get autocomplete for the `id` and `desc` properties
      desc: true,
    }
  ])
}
```
