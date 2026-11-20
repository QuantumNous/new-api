{{ target: component-axis-grid }}

<!-- IGrid -->

Axis grid line configuration.

#${prefix} visible(boolean)

Whether to display the axis grid lines.

#${prefix} alternateColor(string|string[])

Configuration of the fill color between two grid lines. If an array is used, the colors will be displayed alternately according to the configuration.

#${prefix} alignWithLabel(boolean) = true

Whether the grid aligns with the label. The default is true, i.e., aligned. When set to false, it is displayed between the previous and next tick.

#${prefix} style(Object|Function)

Grid line style settings, supporting function callbacks. Callback functions can be used when some personalized configurations are needed.

{{ use:component-common-style-callback(
  description = 'Grid line style'
) }}

Examples:

```ts
grid: {
  style: (value, index, datum) => {
    if (index === 0) {
      return {
        stroke: 'red'
      };
    }

    if (index === 3) {
      return {
        stroke: 'green'
      };
    }

    if (value > 0.03) {
      return {
        stroke: 'pink',
        lineWidth: 4
      };
    }
  };
}
```

{{ use: graphic-line(
  prefix = '#' + ${prefix}
) }}

{{ if: ${smooth} }}
#${prefix} smooth(boolean)

When smooth is true, the grid lines are circular, and when false, they are polygonal.

{{ /if }}