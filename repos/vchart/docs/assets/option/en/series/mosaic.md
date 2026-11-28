{{ target: series-mosaic }}

<!-- IMosaicSeriesSpec -->

**Mosaic Series**, only used for mosaic charts. **Only applicable to Cartesian coordinate systems**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  noStack = ${noStack},
  percent = ${percent},
  useInChart = ${useInChart},
  seriesType = 'mosaic',
  seriesMarks = ['bar'],
  preset = 'grow' + '|' + 'fadeIn' + '|' + 'scaleIn',
  defaultPreset = 'grow'
) }}

#${prefix} bandWidthField(string)

Supported since version 1.13.10.

Column size mapping field, if not declared, will be mapped according to the proportion of total value under the same dimension by default

1. Automatic mapping height when bar chart direction
2. Automatic mapping width when vertical diagram direction

#${prefix} bar(Object)

Bar element style configuration.

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

Bar background element style configuration. This element is not displayed by default.

Supported since version `1.6.0`.

##${prefix} fieldLevel(number)

Determines whether the bar background element is displayed at the group level and at which level it is displayed. Supported since version `1.9.0`.

For example: In a grouped bar chart where `xField` is `['A', 'B', 'C']`, if configured as 0, each group divided by `'A'` corresponds to an overall bar background; if configured as 1, each group divided by `'B'` corresponds to an overall bar background; if configured as 2, each bar corresponds to a bar background.

Default value is each bar corresponds to a bar background.

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

#${prefix} label(Object)

Label configuration.
##${prefix} position(string|Function) = 'outside'
Label position.

Since `1.6.0`, `position` configuration can be in function form in bar series, for example:

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top-right' : 'bottom-right';
  };
}
```

Optional string values ​​are:

- `'outside'`
- `'top'`
- `'bottom'`
- `'left'`
- `'right'`
- `'inside'`
- `'inside-top'`
- `'inside-bottom'`
- `'inside-right'`
- `'inside-left'`
- `'top-right'` // Supported since `1.6.0`
- `'top-left'` // Supported since `1.6.0`
- `'bottom-right'` // Since `1.6.0` Supported
- `'bottom-left'` // Supported since `1.6.0`

##${prefix}filterByGroup(object)

Effective since 1.12.0

Filter label data by group in mosaic

Note: If you customize the data filtering rules, `filterByGroup` will be invalid

###${prefix} field(string)

Group field

###${prefix} type('min' | 'max')

- 'min' filters the maximum value in the group

- 'max' filters the minimum value in the group

###${prefix} filter(Function)

Customize data filtering conditions

{{ use: component-label(
prefix = '#' + ${prefix},
noPosition = true,
hasOverlap = true,
hasSmartInvert = true,
defaultOffset = 5,
hasFilter = true
) }}

{{ use: series-bar-style(
prefix = ${prefix}
) }}

#${prefix} totalLabel(Object)

Total label, effective when the chart is in a stacked scene. Supported since `1.3.0` version.

{{ use: component-total-label(
prefix = '#' + ${prefix},
) }}

#${prefix} sampling(string)
Data sampling - sampling method. Supported since `1.6.0` version.

Mosaic map downsampling strategy when the amount of data is much larger than the pixel point. When enabled, it can effectively optimize the drawing efficiency of the chart. It is closed by default, that is, all data points are drawn without filtering.

Optional value:

- `'lttb'`: Using the Largest-Triangle-Three-Bucket algorithm, the trend, shape and extreme value of the sampled data can be guaranteed to the greatest extent.
- `'min'`: get the minimum value of the filter point
- `'max'`: get the maximum value of the filter point
- `'sum'`: get the sum of the filter points
- `'average'`: get the average of the filter points

#${prefix} samplingFactor(number) = 1
Data sampling - sampling factor. Supported since `1.6.0` version.
