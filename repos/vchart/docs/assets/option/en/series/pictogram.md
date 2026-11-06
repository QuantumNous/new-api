{{ target: series-pictogram }}

<!-- IPictogramSeriesSpec -->

**Pictogram Series**, which can be used to draw pictograms.
{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noMorph = ${noMorph},
  noStack = ${noStack},
  noInvalidType = ${noInvalidType},
  noAnimation = ${noAnimation},
  useInChart = ${useInChart},
  seriesType = 'pictogram',
  seriesMarks = ['pictogram'],
) }} #${prefix} nameField(string)
The name field, corresponding to the name attribute in the SVG resource, is used for the association between graphic elements and data.
#${prefix} valueField(string)
The value field.
#${prefix} svg(string)
The SVG data source.
The name of the map data registered through the `registerSVG` interface, for example:

```ts
// Registered map data named `keyboard`
vchart.registerSVG('keyboard', keyboardSVG);
```

#${prefix} defaultFillColor(string)
The default fill color. When the graphic element is successfully associated with the data but there is no corresponding data, this color is used for filling.
#${prefix} pictogram(Object)
The basic style configuration of the graphic element.
{{ use: common-mark(
  prefix = '#' + ${prefix}
) }} ##${prefix} style(Object)
{{ use: mark-style(
  markName = 'pictogram'
) }}
##${prefix} state(Object)
{{ use: mark-state-style() }}
