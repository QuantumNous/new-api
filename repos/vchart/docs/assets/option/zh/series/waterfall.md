{{ target: series-waterfall }}

<!-- IWaterfallSeriesSpec -->

**waterfall 系列**，用于绘制瀑布图。**仅适用于直角坐标系**。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'waterfall',
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

自 1.6.0 版本开始支持。

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

#${prefix} barWidth(number)

柱体宽度。

#${prefix} barMinWidth(number)

柱体最小宽度。

#${prefix} barMaxWidth(number)

柱体最大宽度。

#${prefix} total(Object)

总计配置。

#${prefix} total.end(Object)

##${prefix} type(string) = 'end'

此类型下，默认在数据最后增加一条总计信息。

##${prefix} text(string)

总计文本。

#${prefix} total.custom(Object)

##${prefix} type(string) = 'custom'

此类型下，总计的运算方式由自定义函数决定。

##${prefix} tagField(string)

总计值的标志位，对应`field`的值为`true`时，认为数据是总计数据。

##${prefix} product(Function)

总计数据在运算时会调用这个函数，参数为**当前总计数据，当前累计信息**，需要返回**总计的起点值与终点值**。回调函数定义如下：

```ts
(datum: Datum, current: { start: number; end: number }) => {
  start: number;
  end: number;
};
```

##${prefix} text(string)

总计文本。

#${prefix} total.field(Object)

##${prefix} type(string) = 'field'

此类型下，总计的运算方式由对应的数据字段决定。

##${prefix} tagField(string)

总计值的标志位，对应`field`的值为`true`时，认为数据是总计数据。

##${prefix} valueField(string)

可以指定总计值。

##${prefix} startField(string)

可以指定总计起点。

##${prefix} collectCountField(string)

可以指定总计计算前 n 个维度。

##${prefix} text(string)

总计文本。

#${prefix} leaderLine(Object)

引导线配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'leaderLine'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

#${prefix} stackLabel(Object)

堆积值标签配置。

##${prefix} position(string)

标签位置。

可选值：

- `'withChange'`: 标签跟随数据变化，数值增加，标签位置与`max` 配置效果一样，数值减少，与`min`效果一样
- `'middle'`: 固定在柱子中间
- `'max'`: 固定在柱子最大值，一般来说是上方，水平方向就是右边
- `'min'`: 固定在柱子最小值，一般来说是下方，水平方向就是左边

##${prefix} offset(number)

标签偏移量。

##${prefix} valueType(number)

标签值。

可选值：

- `'change'`: 展示当前这组数据的变化值
- `'absolute'`: 展示当前这组数据经过变化后的最终值

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} label(Object)

标签配置。

##${prefix} visible(boolean)

标签是否可见。

##${prefix} offset(number)

标签偏移量。

{{ use: component-label(
  prefix = '#' + ${prefix},
  noOffset = true,
) }}
