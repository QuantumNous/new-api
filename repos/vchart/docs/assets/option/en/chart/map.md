{{ target: chart-map }}

# mapChart

Map

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'map'
) }}

{{ use: series-map(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true,
  noStack = true
) }}

{{ use: chart-component(
  noDataZoom = true,
  noCrosshair = true,
  regionType = 'geo'
) }}

##  mapLabel(Object)

The extended component of the map label.

### seriesId(string)

The series id associated with the component. It can be associated with the map series or other series under the geographic coordinate system, such as scatter series in scatter map.

### visible(boolean) = false

Whether to display.

### nameField(string)

Data field for the name text.
### valueField(string)

Data field for the value text.

### trigger('hover'|'click'|'none') = 'none'

Interaction trigger type.

### offset(number) = 12

Pixel distance between the label when not in an "outer" position and the marker point.

### space(number) = 10

Pixel distance between the icon and text.

### position('top'|'bottom'|'left'|'right'|'outer') = 'top'

Label position.

### nameLabel(object)

Name text style settings.
#### visible(boolean)

Whether to display the name text.

#### style(Object)

{{ use: mark-style(
  markName = 'nameLabel'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}


### valueLabel(object)

Value text style settings.
#### visible(boolean)

Whether to display the value text.

#### style(Object)

{{ use: mark-style(
  markName = 'valueLabel'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}

### icon(object)

Icon style settings.

#### visible(boolean)

Whether to display the icon.

#### style(Object)

{{ use: mark-style(
  markName = 'icon'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}

### background(object)

Background style settings.

#### visible(boolean)

Whether to display the background.

#### padding(Object|number) = { top: 4, bottom: 4, left: 6, right: 6 }

Padding settings for the background box. It supports setting values directly and configuring each direction separately through an object type.

- number: Unit in px, configuring all four directions at the same time
- Object: Use the following object type

{{ use: common-layout-padding(
  prefix = '####',
) }}

#### style(Object)

{{ use: mark-style(
  markName = 'background'
) }}

{{ use: graphic-rect(
  prefix = '####'
) }}

### leader(object)

Guide line style settings.

#### visible(boolean)

Whether to display the guide line.

#### style(Object)

{{ use: mark-style(
  markName = 'leader'
) }}

{{ use: graphic-path(
  prefix = '####'
) }}