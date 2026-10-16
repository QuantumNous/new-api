{{ target: chart-histogram }}

# histogramChart

直方图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'histogram'
) }}

{{ use: series-bar(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

## x2Field(string|string[])

x2 字段。（x 字段为频率统计左区间字段，x2 字段为频率统计右区间字段）

## y2Field(string|string[])

y2 字段。（y 字段为频率统计左区间字段，y2 字段为频率统计右区间字段）

## barGap(number)

自 `1.13.11` 版本开始，支持 `barGap` 参数。

用于调整直方图中每个柱子之间的距离，支持传入像素值。

{{ use: chart-component(
  axisType = 'cartesian',
  noBandAxis = true
) }}
