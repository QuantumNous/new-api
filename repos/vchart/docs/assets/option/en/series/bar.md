{{ target: series-bar }}

<!-- IBarSeriesSpec -->

**Bar series**, can be used to draw bar charts, bar graphs, and histograms, etc. **Only applicable to Cartesian coordinate systems**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'bar',
  seriesMarks = ['bar'],
  preset = 'grow' + '|' + 'fadeIn' + '|' + 'scaleIn',
  defaultPreset = 'grow'
) }}

#${prefix} bar(Object)

Bar graphic style configuration.

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

BarBackground mark style configuration. This mark is invisible by default.

Supported since version 1.6.0.

##${prefix} fieldLevel(number)

Whether the barBackground mark is displayed at the group level and at which level it is displayed.

Supported since version 1.9.0.

For example, in a grouped bar chart, `xField` is set to `['A', 'B', 'C']`. If configured as 0, each group divided by `'A'` corresponds to a global barBackground; If configured as 1, each group divided by `'B'` corresponds to a global barBackground; If configured as 2, each bar corresponds to a barBackground.

The default value is that each bar corresponds to a barBackground.

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

Since `1.6.0` version, in bar series, `position` can be a function, for example:

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top-right' : 'bottom-right';
  };
}
```

Optional string values are:

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
- `'top-right'` // Supported since version `1.6.0`
- `'top-left'` // Supported since version `1.6.0`
- `'bottom-right'` // Supported since version `1.6.0`
- `'bottom-left'` // Supported since version `1.6.0`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

{{ use: series-bar-style(
  prefix = ${prefix}
) }}

#${prefix} totalLabel(Object)

Total label, working when the data is stacked. Supported since version `1.3.0`.

{{ use: component-total-label(
  prefix = '#' + ${prefix},
) }}

#${prefix} sampling(string)
Data Sampling - Sampling method. Supported since version `1.6.0`.
The downsampling strategy of the bar chart when the amount of data is much larger than the pixels can effectively optimize the drawing efficiency of the chart when it is turned on. It is turned off by default, that is, all data points are drawn without filtering.
Optional values:

- `'lttb'`: Using the Largest-Triangle-Three-Bucket algorithm, the trend, shape and extreme value of the sampled data can be guaranteed to the greatest extent.
- `'min'`: Get the minimum value of filter points
- `'max'`: Take the maximum value of filter points
- `'sum'`: Take the sum of filter points
- `'average'`: Take the average of the filtered points

#${prefix} samplingFactor(number) = 1
Data Sampling - Sampling coefficients. Supported since version `1.6.0`.
