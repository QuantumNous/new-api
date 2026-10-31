{{ target: component-axis-domain-line }}

<!-- IDomainLine -->

Axis line configuration.

#${prefix} visible(boolean) = true

Display axis line or not.

#${prefix} style(Object)

Styles configuration for axis line.

{{ use: graphic-line(
  prefix = '#' + ${prefix}
) }}

#${prefix} state(Object)

Styles configuration for axis line in different interaction states, **effective when axis hover/select interaction is enabled**, currently supported interaction states are:

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

##${prefix} hover(Object)

Styles configuration when the element is hovered.

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object)

Styles configuration when other elements are hovered.

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object)

Styles configuration when the element is selected.

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object)

Styles configuration when other elements are selected.

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}