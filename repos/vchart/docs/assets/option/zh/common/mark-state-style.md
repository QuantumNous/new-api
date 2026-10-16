{{ target: mark-state-style }}

<!--  Record<StateValue, IMarkStateSpec<T> | IMarkStateStyleSpec<T>>; -->

图元的状态样式配置。

图元的状态样式，指的是图元在某个特定状态下的状态样式。

图元的状态分为 2 大类，一类是内置的交互状态，一类是自定义状态。

内置的交互状态有以下几种

- `hover` 鼠标指针悬浮在图元上时，它的特定状态
- `hover_reverse` 鼠标指针悬浮在图元上时，其他未被悬浮选中的图元的特点状态
- `selected` 选中的图元特定状态，选中请阅读图表的 [select](xxx) 配置。
- `selected_reverse` 没有被选中的图元特定状态，选中请看图表的 [select](xxx) 配置。
- `dimension_hover` 维度选中元素，维度选中请阅读 [event](xxx) 文档。
- `dimension_hover_reverse` 没有被维度选中的图元特定状态。

使用示例：

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

自定义交互状态，对应的类型如下

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

下方的例子使用了自定义状态，我们将配置 type 值为 'A'、'B' 的柱子为 `红色`。`y` 超过 `100` 的透明度设置为 `0.5`。

**注意：多个状态，包括交互状态与自定义状态，它们的样式是可以同时生效的。也就是一个元素可以同时处在多个状态下。**

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
