{{ target: chart-image-cloud }}

# imageCloudChart

图云。自 `2.0.0` 版本开始支持。

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'imageCloud'
) }}

{{ use: series-image-cloud(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}
