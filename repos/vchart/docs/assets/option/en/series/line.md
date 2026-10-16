{{ target: series-line }}

<!-- ILineSeriesSpec -->

**Line Chart**

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'line',
  seriesMarks = ['line', 'point'],
  preset = 'clipIn' + '|' + 'fadeIn' + '|' + 'grow',
  defaultPreset = 'clipIn'
) }}

#${prefix} seriesMark('point'|'line') = 'line'

Supported since `1.2.0` version, it is used to configure the main mark type configuration of the line series, which will affect the display of the legend.

#${prefix} line(Object)

Line graphic style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} point(Object)

Point graphic style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-point(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

Label configuration.

##${prefix} position(string|Function)='top'

Label position.

Since `1.6.0` version, in bar series, `position` can be a function, for example:

```ts
label: {
  position: (datum: any) => {
    return datum.year === '2000' ? 'top' : 'bottom';
  };
}
```

Available string options are:

- `top`
- `bottom`
- `left`
- `right`
- `top-right`
- `top-left`
- `bottom-right`
- `bottom-left`
- `center`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

#${prefix} lineLabel(Object)

Line mark label configuration

Supported since version `1.7.0`.

##${prefix} position(string)='end'

Line label position.

Available string options are:

- `start`
- `end`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = false,
  defaultOffset = 5,
) }}

##${prefix} invalidType(string) = 'break'

Connection method for non-compliant data points. Connection methods for null, undefined, etc. illegal data points.

- 'break' means to disconnect at that data point
- 'link' means to ignore that point and keep connecting continuously
- 'zero' means the default value of that point is 0
- 'ignore' means not to process

#${prefix} sampling(string)
Data Sampling - Sampling method. Supported since version `1.6.0`.
The downsampling strategy of the line chart when the amount of data is much larger than the pixels can effectively optimize the drawing efficiency of the chart when it is turned on. It is turned off by default, that is, all data points are drawn without filtering.
Optional values:

- `'lttb'`: Using the Largest-Triangle-Three-Bucket algorithm, the trend, shape and extreme value of the sampled line can be guaranteed to the greatest extent.
- `'min'`: Get the minimum value of filter points
- `'max'`: Take the maximum value of filter points
- `'sum'`: Take the sum of filter points
- `'average'`: Take the average of the filtered points

#${prefix} samplingFactor(number) = 1
Data Sampling - Sampling coefficients. Supported since version `1.6.0`.

#${prefix} markOverlap(boolean) = false
Anti-overlap - Whether to allow marker graphics to overlap each other. Supported since version `1.6.0`

#${prefix} pointDis(number)
Anti-overlap - Distance between marker points, in px. Supported since version `1.6.0`

#${prefix} pointDisMul(number) = 1
Anti-overlap - distance between marker points, multiple of pointSize. Supported since version `1.6.0`
