{{ target: mark-style }}

<!-- ConvertToMarkStyleSpec<T> -->

${markName} 图元的样式配置。

图元样式上的图形属性除了支持正常的属性赋值外，也允许配置回调函数或者 scale 映射。

- 属性上的回调配置，类型定义如下，其中函数参数分别为
  - `datum` 该图元携带的数据
  - `context` 上下文信息
  - `opt` 图形语法元素信息
  - `source` 数据源 DataView 实例

```ts
export interface IAttributeOpt {
  element: IElement;
  mark: IElement['mark'];
  parent: IElement['mark']['group'];
  states: string[];
}

export type FunctionType<T> = (
  datum: Datum,
  context: IModelMarkAttributeContext,
  opt?: IAttributeOpt,
  source?: DataView
) => T;
```

如下实例，我们期望根据数值的不同为柱子配置不同的颜色：

```ts
bar: {
  style: {
    fill: datum => {
      if (datum.y > 10) {
        return {
          gradient: 'linear',
          x0: 0.5,
          y0: 0,
          x1: 0.5,
          y1: 1,
          stops: [
            {
              offset: 0,
              color: '#86DF6C'
            },
            {
              offset: 1,
              color: '#468DFF'
            }
          ]
        };
      }

      return '#ccc';
    };
  }
}
```

- scale 映射配置

{{ use: common-visual-scale}}
