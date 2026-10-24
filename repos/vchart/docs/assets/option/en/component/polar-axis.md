{{ target: component-polar-axis }}

<!-- Polar coordinate system axis configuration -->
<!-- IPolarAxisSpec -->

## axes(Array|Object)

Coordinate axis configuration under the polar coordinate system, supporting:

- Linear axis: `type: 'linear'`
- Discrete axis: `type: 'band'`

The axis type corresponds to the scale type, the radius axis defaults to 'linear', and the angle axis defaults to 'band'.

TODO: Add illustration.

## axes.linear(Object)

Linear axis configuration.

### type(string) = 'linear'

Declare linear axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'polar',
  type='linear'
) }}

## axes.band(Object)

Discrete axis configuration.

### type(string) = 'band'

Declare discrete axis.

{{ use: component-base-axis(
  prefix = '##',
  coordType = 'polar',
  type='band'
) }}