{{ target: common-layout-padding }}

<!-- ILayoutOrientPadding -->

Padding configuration, with options for setting top, right, bottom, and left paddings.

#${prefix} left(ILayoutNumber)

Left padding configuration.

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}

#${prefix} right(ILayoutNumber)

Right padding configuration.

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}

#${prefix} top(ILayoutNumber)

Top padding configuration.

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}

#${prefix} bottom(ILayoutNumber)

Bottom padding configuration.

{{ use: common-layout-number(
  prefix = '#' + ${prefix},
) }}