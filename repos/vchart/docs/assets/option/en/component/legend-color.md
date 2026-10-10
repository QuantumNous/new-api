{{ target: component-legend-color }}

## legends.color(Object)

Continuous color legend configuration.

**TODO: Add discrete legend illustration**

### type(string) = 'color'

**Required**, used to declare the color legend type, the value is `'color'`.

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