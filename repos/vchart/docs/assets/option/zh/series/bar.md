{{ target: series-bar }}

<!-- IBarSeriesSpec -->

**柱系列**，可用于绘制柱状图、条形图以及直方图等。**仅适用于直角坐标系**。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'bar',
  seriesMarks = ['bar'],
  preset = 'grow' + '|' + 'fadeIn' + '|' + 'scaleIn',
  defaultPreset = 'grow'
) }}

#${prefix} bar(Object)

bar 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'bar'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} barBackground(Object)

barBackground 图元样式配置。该图元默认不显示。

自 `1.6.0` 版本开始支持。

##${prefix} fieldLevel(number)

决定柱状背景图元是否显示在组的层级上，以及显示在哪个层级上。自 `1.9.0` 版本开始支持。

例如：在分组柱状图中，`xField` 为 `['A', 'B', 'C']`，如果配置为 0，则以 `'A'` 划分的每个组对应一个整体的 barBackground；如果配置为 1，则以 `'B'` 划分的每个组对应一个整体的 barBackground；如果配置为 2，则每个柱条对应一个 barBackground。

默认值为每个柱条对应一个 barBackground。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'barBackground'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

标签配置。

##${prefix} position(string|Function) = 'outside'
标签位置。

自 `1.6.0` 版本后，柱系列中，`position` 配置可以为函数形式，例如：

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top-right' : 'bottom-right';
  };
}
```

可选字符串值为：

- `'outside'`
- `'top'`
- `'bottom'`
- `'left'`
- `'right'`
- `'inside'`
- `'inside-top'`
- `'inside-bottom'`
- `'inside-right'`
- `'inside-left'`
- `'top-right'` // 自 `1.6.0` 版本支持
- `'top-left'` // 自 `1.6.0` 支持
- `'bottom-right'` // 自 `1.6.0` 支持
- `'bottom-left'` // 自 `1.6.0` 支持

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

{{ use: series-bar-style(
  prefix =  ${prefix}
) }}

#${prefix} totalLabel(Object)

总计标签，当图表在堆叠场景时生效。自`1.3.0`版本开始支持。

{{ use: component-total-label(
  prefix = '#' + ${prefix},
) }}

#${prefix} sampling(string)
数据采样 - 采样方法。 自`1.6.0`版本开始支持。
柱状图在数据量远大于像素点时候的降采样策略，开启后可以有效的优化图表的绘制效率，默认关闭，也就是全部绘制不过滤数据点。
可选值:

- `'lttb'`: 采用 Largest-Triangle-Three-Bucket 算法，可以最大程度保证采样后的数据趋势，形状和极值。
- `'min'`: 取过滤点的最小值
- `'max'`: 取过滤点的最大值
- `'sum'`: 取过滤点的和
- `'average'`: 取过滤点的平均值

#${prefix} samplingFactor(number) = 1
数据采样 - 采样系数。 自`1.6.0`版本开始支持。
