{{ target: component-indicator }}

## indicator (Object)

Indicator card component.

### visible(boolean) = true

Whether to display the indicator card component.

### fixed(boolean) = true

Initial display state.

Options:

- `true` Keep the content of the indicator card displayed.
- `false` Only display after interaction.

### trigger(string) = 'select'

Interaction trigger type.

Options:

- `hover` Update the indicator card data through hover interaction
- `select` Update the indicator card data through select interaction
- `none`   The indicator card data cannot be updated

### offsetX(number) = 0

X-direction offset for the indicator card.

Supported since `1.3.0` version, two formats are supported: pixel value (number) and percentage (string).

### offsetY(number) = 0

Y-direction offset for the indicator card.

Supported since `1.3.0` version, two formats are supported: pixel value (number) and percentage (string).

### limitRatio(number) = 1

The maximum ratio of the indicator card width to the content area.

### title(Object)

Indicator card title text configuration.

{{ use: component-indicator-item(
  prefix = '###'
) }}

### content(Object|Array)

Indicator card content text configuration.

{{ use: component-indicator-item(
  prefix = '###'
) }}
