{{ target: common-hover }}

<!-- IHoverSpec -->

#${prefix} hover(Object|boolean)

Chart hover interaction configuration. `hover: false` can directly turn off hover interaction.

##${prefix} enable(boolean) = true

Hover interaction switch, enabled by default.

##${prefix} trigger(string|string[]) = 'pointermove'

Configuration for hover interaction trigger event.

{{ use: trigger-spec}}

##${prefix} triggerOff(string|string[]) = ['pointermove', 'pointerleave']

Configuration for hover interaction termination event.

{{ use: trigger-spec}}
