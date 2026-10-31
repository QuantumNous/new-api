{{ target: series-line }}

<!-- ILineSeriesSpec -->

**折线图**

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'line',
  seriesMarks = ['line', 'point'],
  preset = 'clipIn' + '|' + 'fadeIn' + '|' + 'grow',
  defaultPreset = 'clipIn'
) }}

#${prefix} seriesMark('point'|'line') = 'line'

自 `1.2.0` 版本开始支持，用于配置线系列主 mark 类型配置，该配置会影响图例的展示。

#${prefix} line(Object)

line 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} point(Object)

point 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-point(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

标签配置。

##${prefix} position(string|Function)='top'

标签位置。

自 `1.6.0` 版本后，柱系列中，`position` 配置可以为函数形式，例如：

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top' : 'bottom';
  };
}
```

可选字符串值为：

- `top`
- `bottom`
- `left`
- `right`
- `top-right`
- `top-left`
- `bottom-right`
- `bottom-left`
- `center`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

#${prefix} lineLabel(Object)

折线标签配置。

自 `1.7.0` 版本后开始支持。

##${prefix} position(string|Function)='end'

折线标签位置。

可选字符串值为：

- `start`
- `end`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = false,
  defaultOffset = 5,
) }}

##${prefix} invalidType(string) = 'break'

非合规数据点连接方式。null，undefined 等非法数据点连接方式。

- 'break'指在该数据点处断开
- 'link' 指忽略该点保持连续
- 'zero' 指该点默认数值为 0
- 'ignore' 指不处理

#${prefix} sampling(string)
数据采样 - 采样方法。 自`1.6.0`版本开始支持。
折线图在数据量远大于像素点时候的降采样策略，开启后可以有效的优化图表的绘制效率，默认关闭，也就是全部绘制不过滤数据点。
可选值:

- `'lttb'`: 采用 Largest-Triangle-Three-Bucket 算法，可以最大程度保证采样后线条的趋势，形状和极值。
- `'min'`: 取过滤点的最小值
- `'max'`: 取过滤点的最大值
- `'sum'`: 取过滤点的和
- `'average'`: 取过滤点的平均值

#${prefix} samplingFactor(number) = 1
数据采样 - 采样系数。 自`1.6.0`版本开始支持。

#${prefix} markOverlap(boolean) = false
防重叠 - 是否允许标记图形相互覆盖。 自`1.6.0`版本开始支持。

#${prefix} pointDis(number)
防重叠 - 标记点之间的距离，px。 自`1.6.0`版本开始支持。

#${prefix} pointDisMul(number) = 1
防重叠 - 标记点之间的距离，pointSize 的倍数。 自`1.6.0`版本开始支持。
