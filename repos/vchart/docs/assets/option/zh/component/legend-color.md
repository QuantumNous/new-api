{{ target: component-legend-color }}

## legends.color(Object)

连续型颜色图例配置。

**TODO: 补充离散图例图示**

### type(string) = 'color'

**必填**，用于声明颜色图例类型，值为 `'color'`。

{{ use: component-base-legend(
  prefix = '##'
) }}

{{
  use: component-continuous-legend(
    prefix = '##'
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
