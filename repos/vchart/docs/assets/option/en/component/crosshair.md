{{ target: component-crosshair }}

## crosshair(Array|Object)

Crosshair indicator, used to mark points on the chart and add text labels. The performance of the crosshair is different in different coordinate systems. When you need to use the crosshair in multiple coordinate systems, you can use an array to configure each crosshair separately.

TODO: Add illustrations.

{{ use: common-component-id(
  prefix = '##'
) }}

### trigger(string) = 'hover'

The trigger mode of the crosshair, default is 'hover', triggered when the mouse hovers over. Optional values are:

- `'hover'`: Triggered when the mouse hovers.
- `'click'`: Triggered when the mouse clicks.
- `['hover', 'click']`: Triggered when the mouse hovers and clicks simultaneously.

### triggerOff(string | number)

The triggerOff options for hiding the crosshair currently support three settings:

- `'none'`: Does not close the crosshair
- Consistent with the trigger setting, i.e., when `trigger` is `hover`, triggerOff is also `hover`
- `number`: Automatically closes the crosshair after a specified time, in milliseconds

### lockAfterClick(boolean)

Supported since version `1.9.0`

Locks the `crosshair` after clicking, usually used in scenarios where `trigger` is `['hover', 'click']`


### followTooltip(boolean | object)

This configuration has been supported since version `1.11.1`;

It configures whether the crosshair indicator follows the display or hiding of the `tooltip`. Note that when using this trigger mode, the `crosshair`'s own `trigger`, `triggerOff`, and `lockAfterClick` settings will no longer be effective.

当`followTooltip`为对象格式时，类型定义如下：
 
 ```ts
 {
  group?: boolean;
  mark?: boolean;
  dimension?: boolean;
 }
 ```

 * `followTooltip.group` 的值为`false`，表示显示的`tooltip`类型为`group`（即分组信息提示）时，不显示`crosshair`
 * `followTooltip.mark` 的值为`false`，表示显示的`tooltip`类型为`mark`（即mark标记信息提示）时，不显示`crosshair`
 * `followTooltip.dimension` 的值为`false`，表示显示的`tooltip`类型为`dimension`（即维度信息提示）时，不显示`crosshair`



### labelZIndex(number) = 500

The z-index of the crosshair text label.

### gridZIndex(number) = 100

The display level of the crosshair auxiliary graphics.

{{ if: !${isPolar} }}

### xField(Object)

The crosshair configuration on the x-axis in the Cartesian coordinate system.

{{ use: component-crosshair-x-field(
  prefix = '###',
  isPolar = false,
  defaultType = 'rect'
) }}

### yField(Object)

The crosshair configuration on the y-axis in the Cartesian coordinate system.

{{ use: component-crosshair-x-field(
  prefix = '###',
  isPolar = false,
  defaultType = 'line'
) }}

{{ else }}

### categoryField(Object)

The crosshair configuration on the axis corresponding to the `categoryField` field in the polar coordinate system.

{{ use: component-crosshair-x-field(
  prefix = '###',
  isPolar = true,
  defaultType = 'line'
) }}

### valueField(Object)

The crosshair configuration on the axis corresponding to the `valueField` field in the polar coordinate system.

**Note:** `valueField.line.type` only supports 'line' type.

{{ use: component-crosshair-x-field(
  prefix = '###',
  isPolar = true,
  defaultType = 'line'
) }}

{{ /if }}
