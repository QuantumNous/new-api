{{ target: component-legend-size }}

## legends.size(Object)

连续型尺寸图例配置。

**TODO: 补充离散图例图示**

### type(string) = 'size'

**必填**，用于声明尺寸图例类型，值为 `'size'`。

{{ use: component-base-legend(
  prefix = '##'
) }}

{{
  use: component-continuous-legend(
    prefix = '##'
  )
}}

### sizeBackground(Object)

**仅生效于尺寸图例，即 `type: 'size'`**，尺寸图例背景样式配置。

{{
  use: graphic-rect(
    prefix = '###'
  )
}}

{{ use: common-region-and-series-filter(
  prefix = '##',
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'normal',
  defaultLayoutLevel = 50,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
