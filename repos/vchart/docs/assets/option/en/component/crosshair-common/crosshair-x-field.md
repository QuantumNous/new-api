{{ target: component-crosshair-x-field }}

<!-- ICrosshairXFieldSpec -->

#${prefix} visible(boolean) = false

Whether to display the crosshair. Manual configuration is required.

#${prefix} line(Object)

Crosshair auxiliary graphics configuration.

{{
  use: component-crosshair-line(
    prefix = '#' + ${prefix},
    isPolar = ${isPolar},
    defaultType = ${defaultType}
  )
}}

#${prefix} label(Object)

Crosshair text configuration.

{{
  use: component-crosshair-label(
    prefix = '#' + ${prefix},
    isPolar = ${isPolar},
  )
}}

{{ use: component-crosshair-data-bind(
  prefix = ${prefix},
) }}