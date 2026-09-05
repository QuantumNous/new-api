{{ target: series-pictogram }}

<!-- IPictogramSeriesSpec -->

**象形图系列**，可用于绘制象形图。

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noMorph = ${noMorph},
  noStack = ${noStack},
  noInvalidType = ${noInvalidType},
  noAnimation = ${noAnimation},
  useInChart = ${useInChart},
  seriesType = 'pictogram',
  seriesMarks = ['pictogram'],
) }}

#${prefix} nameField(string)

name 字段，与 SVG 资源中的 name 属性对应，用于图元与数据的关联。

#${prefix} valueField(string)

value 字段。

#${prefix} svg(string)

SVG 数据源。
通过 `registerSVG` 接口注册的地图数据名称，例如：

```ts
// 注册了名为 `keyboard` 的地图数据
vchart.registerSVG('keyboard', keyboardSVG);
```

#${prefix} defaultFillColor(string)

默认填充色。当图元与数据成功关联，但没有对应的数据时，使用该颜色填充。

#${prefix} pictogram(Object)

图元基础样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'pictogram'
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
