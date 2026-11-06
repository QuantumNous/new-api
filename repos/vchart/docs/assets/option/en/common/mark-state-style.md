{{ target: mark-state-style }}

<!--  Record<StateValue, IMarkStateSpec<T> | IMarkStateStyleSpec<T>>; -->

Element's state style configuration.

The state style of an element refers to the style of the element in a specific state.

There are two main types of element states: built-in interaction states and custom states.

The built-in interaction states include the following:

- `hover` the specific state of the element when the mouse pointer is hovering over it
- `hover_reverse` the specific state of other elements not being hovered over when the mouse pointer is hovering over an element
- `selected` specific state of the selected element; for selection, please refer to the chart's [select](xxx) configuration
- `selected_reverse` the specific state of the unselected element; for selection, please see the chart's [select](xxx) configuration
- `dimension_hover` dimension selected element; for dimension selection, please read the [event](xxx) documentation
- `dimension_hover_reverse` the specific state of elements not selected by dimension

Usage examples:

```ts
point: {
  state: {
    dimension_hover: {
      fill: 'green'
    },
    dimension_hover_reverse: {
      fill: 'gray'
    }
  }
}
```

The corresponding types for custom interaction states are as follows:

```ts
// 配置接口
export interface IMarkStateSpec<T> {
  /** 筛选器 */
  filter?: IMarkStateFilter;
  /** 状态优先级 */
  level?: number | undefined;
  style: ConvertToMarkStyleSpec<T>;
}

// 筛选器类型
export type IMarkStateFilter =
  | {
      /** 维度筛选 */
      fields: { [key in string]: { type: 'ordinal' | 'linear'; domain: StringOrNumber[] } };
    }
  | {
      /** 筛选数据 */
      datums: Datum[];
      /** 筛选数据 */
      datumKeys: string[];
    }
  |
  /** 筛选函数 */
  | ((datum: Datum, options: Record<string, any>) => boolean);
```

The following example uses custom states, and we will configure the columns with type values 'A' and 'B' to be `Red`. The `y` value that exceeds `100` will set the opacity to `0.5`.

**Note: Multiple states, including interaction states and custom states, can take effect at the same time. That is, an element can be in multiple states simultaneously.**

```ts
bar: {
  state: {
    custom_type: {
      filter: {
        type: {
          domain: ['A','B']
        }
      },
      style: {
        fill: 'red'
      }
    },
    custom_y: {
      filter: (datum)=>{
        return datum.y > 100
      },
      style: {
        fillOpacity: 0.5
      }
    }
  }
}

```