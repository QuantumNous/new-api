{{ target: component-axis-grid }}

<!-- IGrid -->

坐标轴网格线配置。

#${prefix} visible(boolean)

是否显示坐标轴网格线。

#${prefix} alternateColor(string|string[])

两个栅格线间的填充色配置，如果使用数组，则会根据配置的颜色交替显示。

#${prefix} alignWithLabel(boolean) = true

grid 是否与 label 对齐，默认为 true，即对齐，配置为 false 则显示在前后两个刻度中间。

#${prefix} style(Object|Function)

网格线样式设置，支持函数回调，当需要走一些个性化配置时可以使用回调函数。

{{ use:component-common-style-callback(
  description = '网格线样式'
) }}

示例：

```ts
grid: {
  style: (value, index, datum) => {
    if (index === 0) {
      return {
        stroke: 'red'
      };
    }

    if (index === 3) {
      return {
        stroke: 'green'
      };
    }

    if (value > 0.03) {
      return {
        stroke: 'pink',
        lineWidth: 4
      };
    }
  };
}
```

{{ use: graphic-line(
  prefix = '#' + ${prefix}
) }}

{{ if: ${smooth} }}
#${prefix} smooth(boolean)

smooth 为 true 时为圆形网格线 false 则为多边形网格线。

{{ /if }}
