{{ target: common-series-style }}

<!-- ISeriesStyleSpec -->

#${prefix} seriesStyle(Array)

Series style configuration, only takes effect when the chart is configured with `seriesField`. Through this configuration, you can uniformly style the graphics for a specific group of data (the value of the grouping field `seriesField`).

The complete type definition is as follows, an array type, used for multi-group data graphic style configuration.

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

Example:

If there's a dataset with `seriesField` values as: `['18-34','35-49','50-64','65+']`, and we need to apply a special style definition for the `'50-64'` group's lines, then you can use the `seriesStyle` attribute as follows:

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