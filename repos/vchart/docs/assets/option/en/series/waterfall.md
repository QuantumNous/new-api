{{ target: series-waterfall }}

<!-- IWaterfallSeriesSpec -->

**waterfall series** is used for drawing waterfall charts. **Only applicable to Cartesian coordinate systems**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'waterfall',
  seriesMarks = ['bar'],
  preset = 'grow' + '|' + 'fadeIn' + '|' + 'scaleIn',
  defaultPreset = 'grow'
) }}

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

#${prefix} barWidth(number)

Bar width.

#${prefix} barMinWidth(number)

Bar minimum width.

#${prefix} barMaxWidth(number)

Bar maximum width.

#${prefix} total(Object)

Total configuration.

#${prefix} total.end(Object)

##${prefix} type(string) = 'end'

Under this type, a total value will be added to the end of the data by default.

##${prefix} text(string)

Total text.

#${prefix} total.custom(Object)

##${prefix} type(string) = 'custom'

Under this type, the way of total calculation is determined by a custom function.

##${prefix} tagField(string)

Indicates the total value when the value of the corresponding `field` is `true`.

##${prefix} product(Function)

This function will be called during the calculation of the total value, with parameters **current total data, current accumulated information** and returns **start and end values for total**. The callback function is defined as follows:

```ts
(datum: Datum, current: { start: number; end: number }) => {
  start: number;
  end: number;
};
```

##${prefix} text(string)

Total text.

#${prefix} total.field(Object)

##${prefix} type(string) = 'field'

Under this type, the method of total calculation is determined by the corresponding data field.

##${prefix} tagField(string)

Indicates the total value when the value of the corresponding `field` is `true`.

##${prefix} valueField(string)

Specifies the total value.

##${prefix} startField(string)

Specifies the total starting point.

##${prefix} collectCountField(string)

Specifies the total calculation before the first n dimensions.

##${prefix} text(string)

Total text.

#${prefix} leaderLine(Object)

Leader line configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'leaderLine'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

#${prefix} stackLabel(Object)

Stack value label configuration.

##${prefix} position(string)

Label position.

Optional values:

- `'withChange'`: The label follows the data change, the value increases, the label position is the same as the `'max'` configuration, the value decreases, and it is the same as the `'min'` effect.
- `'middle'`: Fixed in the middle of the bar
- `'max'`: Fixed at the maximum value of the bar, usually at the top, horizontally on the right side
- `'min'`: Fixed at the minimum value of the bar, usually at the bottom, horizontally on the left side

##${prefix} offset(number)

Label offset.

##${prefix} valueType(number)

Label value.

Optional values:

- `'change'`: Display the change value of the current group of data
- `'absolute'`: Display the final value of the current data group after the change

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} label(Object)

Label configuration.

##${prefix} visible(boolean)

Whether the label is visible.

##${prefix} offset(number)

Label offset.

{{ use: component-label(
  prefix = '#' + ${prefix},
  noOffset = true,
) }}
