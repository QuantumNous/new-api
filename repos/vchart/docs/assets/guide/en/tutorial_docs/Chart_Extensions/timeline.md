# Extension Chart: Timeline Chart

Timeline Chart is a visualization chart used to display events in chronological order, particularly suitable for showing project progress, corporate development history, product iteration processes, and similar scenarios.

VChart provides a timeline chart extension component that supports both horizontal and vertical layout modes, with flexible configuration of event node styles, label positions, icons, and other elements.

![img](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/timeline/timeline-basic.png)

## How to Use Extension Charts

Timeline charts need to be manually registered before use. The registration and usage methods are as follows:

```js
import VChart from '@visactor/vchart';
import { registerTimelineChart } from '@visactor/vchart-extension';

const spec = {
  type: 'timeline'
  //  your spec
};
registerTimelineChart();

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();
```

If using CDN import, the registration method is as follows:

```html
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart-extension/build/index.min.js"></script>
<script>
  const spec = {
    type: 'timeline'

    //  your spec
  };
  VChartExtension.registerTimelineChart();

  const vchart = new VChart.default(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## Related Configuration Items

### Timeline Chart Configuration

```ts
export interface ITimelineChartSpec extends ICartesianChartSpec {
  type: 'timeline';
  /**
   * Timeline direction
   * - 'horizontal': Horizontal direction, time flows from left to right
   * - 'vertical': Vertical direction, time flows from top to bottom
   */
  direction?: 'horizontal' | 'vertical';
  /**
   * Series configuration
   */
  series?: IEventSeriesSpec[];
}
```

### Event Series Configuration

```ts
export interface IEventSeriesSpec extends ICartesianSeriesSpec {
  type: 'event';
  /**
   * Time field, used to specify the position of events on the timeline
   */
  timeField?: string;
  /**
   * Event name field
   */
  eventField?: string;
  /**
   * Event detail field (subtitle)
   */
  subTitleField?: string;
  /**
   * Icon field, used to display icons or images
   */
  iconField?: string;
  /**
   * Series field, used for grouped display
   */
  seriesField?: string;
  /**
   * Position of title and subtitle
   * - Horizontal layout: 'top' | 'bottom' | 'top-bottom' | 'bottom-top'
   * - Vertical layout: 'left' | 'right' | 'left-right' | 'right-left'
   */
  labelPosition?: LabelPosition;
  /**
   * Icon mark configuration
   * offset: Icon offset distance relative to the dot, in pixels. Positive values offset outward, negative values offset inward
   */
  icon?: IMarkSpec<ISymbolMarkSpec> & { offset?: number };
  /**
   * Event title mark configuration
   * subTitleGap: Gap between title and subtitle, in pixels
   * offset: Title offset distance relative to the dot, in pixels. Positive values offset outward, negative values offset inward
   */
  title?: IMarkSpec<ITextMarkSpec> & { subTitleGap?: number; offset?: number };
  /**
   * Event subtitle mark configuration
   */
  subTitle?: IMarkSpec<ITextMarkSpec>;
  /**
   * Event line mark configuration
   */
  line?: IMarkSpec<ILineMarkSpec>;
  /**
   * Arrow mark configuration
   * thickness: Arrow thickness, in pixels
   */
  arrow?: IMarkSpec<IPathMarkSpec> & { thickness?: number };
}
```

## Timeline Chart Examples

- [Basic Timeline Chart](/vchart/demo/extension-chart/timeline-basic)
- [Timeline Chart with Icons](/vchart/demo/extension-chart/timeline-with-icon)

## Configuration Details

### Layout Direction

Timeline charts support two layout directions:

- **Horizontal Layout** (`direction: 'horizontal'`): Time flows from left to right, suitable for displaying horizontal timeline processes
- **Vertical Layout** (`direction: 'vertical'`): Time flows from top to bottom, suitable for displaying vertical development histories

### Data Field Configuration

Timeline charts require the following data field configurations:

- `timeField`: Time field, used to determine the position of events on the timeline
- `eventField`: Event name field, displayed as the title
- `subTitleField`: Event detail field, displayed as subtitle (optional)
- `iconField`: Icon field, used to display icons or images (optional)
- `seriesField`: Series field, used for grouped display of multiple timelines (optional)

### Label Position Configuration

The `labelPosition` controls the display position of titles and subtitles:

**For Horizontal Layout:**

- `top`: Title always above the timeline
- `bottom`: Title always below the timeline
- `top-bottom`: Titles alternate between top and bottom (first on top, second on bottom)
- `bottom-top`: Titles alternate between bottom and top (first on bottom, second on top)

**For Vertical Layout:**

- `left`: Title always on the left of the timeline
- `right`: Title always on the right of the timeline
- `left-right`: Titles alternate between left and right (first on left, second on right)
- `right-left`: Titles alternate between right and left (first on right, second on left)

### Icon Feature

Timeline charts support adding icons to event nodes. Icons are displayed symmetrically with titles relative to the timeline:

- Horizontal layout: When title is above, icon is below; when title is below, icon is above
- Vertical layout: When title is on the left, icon is on the right; when title is on the right, icon is on the left

Icons can use VChart's built-in symbol shapes (such as 'star', 'diamond', 'triangleUp', etc.) or image URLs.

### Style Configuration

#### Dot Mark Style

Configure dot mark style for event nodes via `dot`:

```js
dot: {
  style: {
    size: 12,
    fill: '#4A90E2',
    stroke: '#fff',
    lineWidth: 2
  }
}
```

#### Icon Style

Configure icon style via `icon`:

```js
icon: {
  style: {
    size: 24,
    fill: '#4A90E2',
    shape: 'star' // or image URL
  }
}
```

#### Title Style

Configure title and subtitle styles separately via `title` and `subTitle`:

```js
title: {
  style: {
    fontSize: 14,
    fontWeight: 'bold',
    fill: '#333'
  }
},
subTitle: {
  style: {
    fontSize: 12,
    fill: '#666',
    lineHeight: 18
  }
}
```

#### Timeline Line Style

Configure timeline line style via `line`:

```js
line: {
  style: {
    stroke: '#c0c3c7',
    lineWidth: 2
  }
}
```

#### Arrow Style

Configure connecting arrow style via `arrow`:

```js
arrow: {
  visible: true,
  thickness: 16,
  style: {
    fill: '#4A90E2'
  }
}
```

### Grouped Display

By configuring `seriesField`, you can implement grouped display of multiple timelines, suitable for comparing timelines of multiple themes or categories.

### Interactive Features

Timeline charts support the following interactive features:

- **Tooltip**: When hovering over dot marks, icons, or arrows, detailed event information is displayed
- **Click Events**: You can listen to click events on dot marks to implement custom interactions

## Application Scenarios

Timeline charts are suitable for the following scenarios:

1. **Project Management**: Display project milestones and key nodes
2. **Corporate Development**: Show company development history and important events
3. **Product Iteration**: Display product version update history
4. **Historical Events**: Show chronological order of historical events
5. **Resume**: Display work experience and educational background

## Notes

1. Time fields should be numeric or date types to ensure correct sorting
2. When using `seriesField` for grouping, reasonably control the number of groups to avoid overcrowded charts
3. Label position selection should consider content length and chart space to avoid text overlap
4. Icon size should coordinate with the overall layout, not too large or too small
