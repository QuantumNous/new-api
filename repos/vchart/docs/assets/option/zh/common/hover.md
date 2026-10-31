{{ target: common-hover }}

<!-- IHoverSpec -->

#${prefix} hover(Object|boolean)

图表 hover 交互配置。 `hover: false` 可直接关闭 hover 交互。

##${prefix} enable(boolean) = true

hover 交互开关，默认开启。

##${prefix} trigger(string|string[]) = 'pointermove'

hover 交互的触发事件配置。
{{ use: trigger-spec}}

##${prefix} triggerOff(string|string[]) = ['pointermove', 'pointerleave']

hover 交互的终止事件配置。
{{ use: trigger-spec}}
