{{ target: common-cartesian-series }}

<!-- ICartesianSeriesSpec -->

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = ${seriesType},
  seriesMarks = ${seriesMarks},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  noPreset = ${noPreset},
  preset = ${preset},
  noStack = ${noStack},
  percent = ${percent},
  defaultPreset = ${defaultPreset}
) }}

{{ use: common-direction(
  prefix = ${prefix}
) }}

#${prefix} xField(string|string[])

x 字段。可以声明为数组类型，内部会依次按照声明的字段进行数据分组。

#${prefix} yField(string|string[])

y 字段。可以声明为数组类型，内部会依次按照声明的字段进行数据分组。

#${prefix} zField(string|string[])

z 字段。可以声明为数组类型，内部会依次按照声明的字段进行数据分组。（正常不需要配置，如果想要 3d 散点，3d 线图，3d 面积图的话可以配置，同时还可以配置一个 z 轴）

{{ if: ${x2Field} }}
#${prefix} x2Field(string)

用于区间数据，声明区间末尾的数据字段。

{{ /if }}

{{ if: ${y2Field} }}
#${prefix} y2Field(string)

用于区间数据，声明区间末尾的数据字段。

{{ /if }}

#${prefix} sortDataByAxis(boolean)

sortDataByAxis 字段。指定数据是否按照 x 轴顺序排序，可以保证不确定数据顺序的情况下图形以正确的顺序绘制。如果期望不要打乱原始数据的顺序，请配置为 false
