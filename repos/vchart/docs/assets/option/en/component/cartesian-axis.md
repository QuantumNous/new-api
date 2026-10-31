{{ target: component-cartesian-axis }}

<!-- Cartesian coordinate axis configuration -->
<!-- ICartesianAxisSpec -->

## axes(Array|Object)

Cartesian coordinate axis configuration, supports:

- Linear axis: `type: 'linear'`
- Discrete axis: `type: 'band'`
- Time axis: `type: 'time'`
- Log axis: `type: 'log'`
- Symlog axis: `type: 'symlog'`

Note: Histograms do not support discrete axes, as histograms are used to count the frequency distribution within data intervals, and the main axis must be passed as numerical intervals, which are not supported by discrete axes.

Axis types correspond to scale types

- In Cartesian coordinates, the default x-axis is 'band' and the y-axis is 'linear'; when `direction` is 'horizontal', the x-axis is 'linear' and the y-axis is 'band'.
- In polar coordinates, the default radial axis is 'linear' and the angular axis is 'band'.

**If you need to draw multiple axes in one chart, use an array configuration.**

TODO: Add illustrations.

## axes.linear(Object)

Linear axis configuration.

### type(string) = 'linear'

Declare a linear axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'cartesian',
  type='linear'
) }}

{{ if: !${noBandAxis} }}
## axes.band(Object)

Discrete axis configuration.

### type(string) = 'band'

Declare a discrete axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'cartesian',
  type='band'
) }}
{{ /if }}

## axes.time(Object)

Time axis configuration.

### type(string) = 'time'

Declare a time axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'cartesian',
  type='time',
  noInverse=true
) }}

## axes.log(Object)

Supported since `1.2.0` version, Log axis configuration.

### type(string) = 'log'

Declare a log axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'cartesian',
  type='log'
) }}

## axes.symlog(Object)

Supported since `1.3.0` version, Symlog axis configuration.

### type(string) = 'symlog'

Declare a symlog axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'cartesian',
  type='symlog'
) }}