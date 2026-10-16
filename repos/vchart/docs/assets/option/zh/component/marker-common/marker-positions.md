{{ target: component-marker-point-like }}

{{ if: ${isSingle} }}

自 1.12.0 版本，`position` 可以直接配置回调函数，回调函数需要返回坐标点，如下：

```ts
/**
 * @param `seriesData` 为关联系列的数据
 * @param `series` 为关联系列实例
 */
position: (seriesData, series) => {
  return { x: 10, y: 30 };
};
```

{{ else }}

自 1.12.0 版本，`positions` 可以直接配置回调函数，回调函数需要返回坐标点数组，如下：

```ts
/**
 * @param `seriesData` 为关联系列的数据
 * @param `series` 为关联系列实例
 */
positions: (seriesData, series) => {
  return [
    { x: 10, y: 30 },
    { x: 130, y: 30 }
  ];
};
```

{{/if}}

#${prefix} x(number)
x 坐标位置，number 类型表示像素值，string 类型表示相对画布宽度或者 region 宽度的占比（从左往右）。

#${prefix} y(number)
y 坐标位置，number 类型表示像素值，string 类型表示相对画布高度或者 region 高度的占比（从上至下）。
