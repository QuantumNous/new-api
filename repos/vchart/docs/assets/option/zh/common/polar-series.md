{{ target: common-polar-series }}

<!-- IPolarSeriesSpec -->

{{ use: common-series(
prefix = ${prefix},
noType = ${noType},
noData = ${noData},
seriesType = ${seriesType},
noMorph = ${noMorph},
useInChart = ${useInChart},
noPreset = ${noPreset},
preset = ${preset},
defaultPreset = ${defaultPreset},
seriesMarks = ${seriesMarks},
) }}

{{ if: !${noCategoryField} }}
#${prefix} categoryField(string|string[])

类别字段，映射到角度轴。可以声明为数组类型，内部会依次按照声明的字段进行数据分组。
{{ /if }}

{{ if: !${noValueField} }}
#${prefix} valueField(string|string[])

数值字段，映射到半径轴。可以声明为数组类型，内部会依次按照声明的字段进行数据分组。
{{ /if }}

#${prefix} outerRadius(number) = 0.6

扇区外半径，数值的范围为 0 - 1。

#${prefix} innerRadius(number) = 0

扇区内半径，数值的范围为 0 - 1。

#${prefix} startAngle(number) = -90

扇区起始角度。角度制。

#${prefix} endAngle(number) = 270

扇区结束角度。角度制。

#${prefix} centerX (Number|String)

极坐标中心点 x 坐标，支持两种格式：

- `number`: 具体的坐标值
- `string`: 格式如`50%`的百分比字符串，相对于布局宽度计算坐标（自**1.11.2**版本开始支持）

#${prefix} centerY (Number|String)

极坐标中心点 y 坐标，支持两种格式：

- `number`: 具体的坐标值
- `string`: 格式如`50%`的百分比字符串，相对于布局高度计算坐标（自**1.11.2**版本开始支持）
