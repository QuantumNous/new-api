{{ target: component-legend-size }}

## legends.size(Object)

Continuous size legend configuration.

**TODO: Add discrete legend illustration**

### type(string) = 'size'

**Required**, for declaring the size legend type, the value is `'size'`.

{{ use: component-base-legend(
  prefix = '##'
) }}

{{
  use: component-continuous-legend(
    prefix = '##'
  )
}}

### sizeBackground(Object)

**Effective only for size legends, i.e. `type: 'size'`**, size legend background style configuration.

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