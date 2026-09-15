{{ target: component-continuous-legend }}

<!-- IContinuousLegendSpec -->

#${prefix} field(string)

Optional, declare the associated mapping field.

#${prefix} scale(string)

Optional, continuous legend associated mapping scale id (this scale needs to be generated through the [global scale](todo) configuration, that is, `spec.scales`). If not specified, it will automatically match according to the legend type.

#${prefix} slidable(boolean) = true

Enable slider interaction.

#${prefix} inverse(boolean)

Supported since version 1.11.0

Enable reverse

#${prefix} defaultSelected(Array)

Set the default selected legend items when the legend is initialized. Elements in the array correspond to the default filtered data range, such as `[0, 100]` which means filtering data with values between 0 and 100.

#${prefix} rail(Object)

Configuration for the slider rail.

##${prefix} width(number)

The width of the sliding rail.

##${prefix} height(number)

The height of the sliding rail.

##${prefix} style(Object)

Style configuration for the sliding rail.

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} handler(Object)

Configuration for the sliding handle.

##${prefix} visible(boolean) = true

Whether to display the sliding handle. Displayed by default.

##${prefix} style(Object)

Style configuration for the sliding handle.

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

#${prefix} track(Object)

Style settings for the selected area of the slider.

##${prefix} style(Object)

Style configuration for the selected area of the slider.

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} startText(Object)

Configuration for the legend rail's left text.

##${prefix} visible(boolean) = false

Whether to display the left text of the legend rail.

##${prefix} text(string)

The content of the left text of the legend rail.

##${prefix} space(number) = 6

The space between the left text of the legend rail and the slider.

##${prefix} style(Object)

Style configuration for the left text of the legend rail.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} endText(Object)

Configuration for the legend rail's right text.

##${prefix} visible(boolean) = false

Whether to display the right text of the legend rail.

##${prefix} text(string)

The content of the right text of the legend rail.

##${prefix} space(number) = 6

The space between the right text of the legend rail and the slider.

##${prefix} style(Object)

Style configuration for the right text of the legend rail.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} handlerText(Object)

Configuration for the text on the slider handle.

##${prefix} visible(boolean) = false

Whether to display the text on the slider handle.

##${prefix} precision(number)

The decimal precision of the data display, default 0, no decimal point.

##${prefix} formatter(Function)

Formatting function for data display. The function is defined as: `(text: string) => string`.

##${prefix} space(number) = 6

The space between the text on the slider handle and the slider.

##${prefix} style(Object)

Style configuration for the text on the slider handle.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

{{ use: component-base-legend(
  prefix = ${prefix}
) }}