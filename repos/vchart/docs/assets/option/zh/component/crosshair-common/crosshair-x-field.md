{{ target: component-crosshair-x-field }}

<!-- ICrosshairXFieldSpec -->

#${prefix} visible(boolean) = false

是否显示 crosshair。需要手动配置。

#${prefix} line(Object)

crosshair 辅助图形配置。

{{
  use: component-crosshair-line(
    prefix = '#' + ${prefix},
    isPolar = ${isPolar},
    defaultType = ${defaultType}
  )
}}

#${prefix} label(Object)

crosshair 文本配置。

{{
  use: component-crosshair-label(
    prefix = '#' + ${prefix},
    isPolar = ${isPolar},
  )
}}

{{ use: component-crosshair-data-bind(
  prefix = ${prefix},
) }}
