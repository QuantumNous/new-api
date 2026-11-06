{{ target: common-layout-padding }}

<!-- ILayoutOrientPadding -->

内边距配置，可设定上右下左边距。

#${prefix} left(ILayoutNumber)

左边距配置。

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}

#${prefix} right(ILayoutNumber)

右边距配置。

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}

#${prefix} top(ILayoutNumber)

上边距配置。

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}

#${prefix} bottom(ILayoutNumber)

下边距配置。

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}
