{{ target: component-brush }}

## brush(Object)

Selection box component.

### visible(boolean) = true

Component visibility.

### regionIndex(number|number[])

The index of regions that support selection.

### regionId(string|string[])

The ID of regions that support selection.

### seriesIndex(number|number[])

The index of series that support selection.

### seriesId(string|string[])

The ID of series that support selection.

### brushLinkSeriesIndex(number|number[])

The index of series that support linked selection.

### brushLinkSeriesId(string|string[])

The ID of series that support linked selection.

### inBrush(Object)

The graphical element style within the selection range.

{{ use: component-brush-selected-item-style(
  prefix = '###'
) }}

### outOfBrush(Object)

The graphical element style outside the selection range.

{{ use: component-brush-selected-item-style(
  prefix = '###'
) }}

### brushMode(string)

Selection mode.

Available options:

- `'single'`: Single selection
- `'multiple'`: Multiple selection

### brushType(string)

Selection box type.

Available options:

- `'x'`: Horizontal selection
- `'y'`: Vertical selection
- `'rect'`: Rectangular selection box
- `'polygon'`: Arbitrary shape selection box

### brushMoved(boolean) = true

Whether the selection box can be moved.

### removeOnClick(boolean) = true

In single selection mode, whether to clear the selection box by clicking.

### delayType(string) = 'throttle'

Event-triggering delay type.

Available options:

- `'throttle'`: Throttle
- `'debounce'`: Debounce

### delayTime(number) = 10

Event-triggering delay duration.

### sizeThreshold(number) = 5

The size threshold of the brush selection box. Supported since version `1.2.0`.

### zoomAfterBrush(boolean) = false

Whether to turn on the brush to remove the drill. Effective from version 0.10.0.

### updateElementsState(boolean) = true

Whether to update element states. Disabling this can optimize performance in zooming scenarios. Effective since version 1.13.13.

### zoomWhenEmpty(boolean) = false

Whether to drill down when empty data is retrieved. Effective from version 1.12.2.

### axisId(string|string[])

Brush the axisId of the linkage. Effective from version 0.10.0.

1. If you enable brush removal and drilling, all associated axes and dataZoom will be linked by default.
2. DataZoom filterMode: 'axis' can only be used for brushing normally (filterMode: 'filter' will change the axis domain, causing calculation errors)

### axisIndex(number|number[])

Brush the linked axisIndex. Effective from version 0.10.0.

1. If you enable brush removal and drilling, all associated axes and dataZoom will be linked by default.
2. DataZoom filterMode: 'axis' can only be used for brushing normally (filterMode: 'filter' will change the axis domain, causing calculation errors)

### axisRangeExpand(number)

When updating the dataZoom range, expand the range, expand the range by percentage, for example: dataZoomRangeExpand = 0.05, which means newStart - 0.05 & newEnd + 0.05 during update.:

1. When scaling continuous axes: The zero, nice, min, max and other configurations of the axis may cause the axis range to be inconsistent with the dataZoom range (this problem is best solved through DataZoom.customDomain)
2. When scaling the continuous axis: The scatter plot is positioned according to the scatter point center. If updated strictly according to the center range, the scatter points will exceed the canvas.
3. When scaling discrete axes: You do not want to strictly follow the filtered data range, but you want to still have space at both ends after scaling.

### markTypeFilter(string[])

Mark types that do not need to be operated by brush. (For example, for line charts, if you only want to select point elements but not line elements, you can configure `markTypeFilter: ['line']`)
Effective since version 1.13.9.

### onBrushEnd(Function)

Custom brush event, trigger time: selection ends.
Return true to clear the brush.
Effective since version 1.13.9.

`onBrushEnd: (e: any) => boolean;`

### style(Object)

Selection box style configuration.

{{ use: graphic-polygon(
  prefix = '###'
) }}
