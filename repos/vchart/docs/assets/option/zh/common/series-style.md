{{ target: common-series-style }}

<!-- ISeriesStyleSpec -->

#${prefix} seriesStyle(Array)

系列样式配置，仅在图表配置了 `seriesField` 时生效。通过该配置，可以为具体的某一组数据（分组字段 `seriesField` 的数值）的图形进行统一的样式配置。

完整的类型定义如下，数组类型，用于多组数据的图元样式配置。

```ts
export type ISeriesStyle = ISeriesStyleItem[];
export type ISeriesStyleItem = {
  name: string;
} & {
  /**
   * markName 对应图元的名称，不同的图表对应不同的图元
   */
  [markName: string]: {
    /**
     * 配置图元的样式
     */
    style?: any;
  };
};
```

示例：

如有一组数据，其 `seriesField` 字段对应的数值为：`['18-34','35-49','50-64','65+']`，我们需要对 `'50-64'` 组的线进行特殊的样式定义，那么就可以使用 `seriesStyle` 属性进行如下定义：

```ts
seriesStyle: [
  {
    name: '50-64',
    line: {
      style: {
        stroke: '#000',
        lineWidth: 10
      }
    }
  }
],
```
