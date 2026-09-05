---
category: examples
group: extension chart
title: Timeline Chart - Grouped Display
keywords: extension, timeline, group
order: 4
cover: /vchart/preview/timeline-group_2.0.jpeg
option: extensionChart
---

# Timeline Chart - Grouped Display

By configuring seriesField, multiple timelines can be displayed in the same chart, suitable for comparing timelines of different themes or categories.

## Key Configurations

- `seriesField` Specifies the grouping field
- Multiple timelines are displayed in parallel, each timeline displays independently

## Demo Code

```javascript livedemo
/** --Please add the following code when using in business-- */
// When using in business, please additionally depend on @visactor/vchart-extension, keeping the package version consistent with vchart
// import { registerTimelineChart } from '@visactor/vchart-extension';
/** --Please add the above code when using in business-- */

/** --Please delete the following code when using in business-- */
const { registerTimelineChart } = VChartExtension;
/** --Please delete the above code when using in business-- */

const spec = {
  type: 'timeline',
  direction: 'horizontal',
  padding: {
    left: 60,
    right: 60,
    top: 100,
    bottom: 100
  },
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          category: 'Product Line A',
          title: 'V1.0',
          detail: 'Initial release',
          time: 1,
          color: '#4A90E2'
        },
        {
          category: 'Product Line A',
          title: 'V2.0',
          detail: 'Feature enhancement',
          time: 3,
          color: '#4A90E2'
        },
        {
          category: 'Product Line A',
          title: 'V3.0',
          detail: 'Performance optimization',
          time: 5,
          color: '#4A90E2'
        },
        {
          category: 'Product Line B',
          title: 'Beta',
          detail: 'Beta version',
          time: 2,
          color: '#50C8C8'
        },
        {
          category: 'Product Line B',
          title: 'V1.0',
          detail: 'Official release',
          time: 4,
          color: '#50C8C8'
        },
        {
          category: 'Product Line B',
          title: 'V2.0',
          detail: 'Major update',
          time: 6,
          color: '#50C8C8'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Multi-Product Line Comparison',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      min: 0,
      max: 7
    },
    {
      orient: 'left',
      type: 'band'
    }
  ],
  timeField: 'time',
  eventField: 'title',
  subTitleField: 'detail',
  seriesField: 'category',
  labelPosition: 'top-bottom',
  dot: {
    style: {
      size: 12,
      fill: datum => datum.color,
      stroke: '#fff',
      lineWidth: 2
    }
  },
  title: {
    style: {
      fill: '#333',
      fontSize: 13,
      fontWeight: 'bold'
    }
  },
  subTitle: {
    style: {
      fill: '#666',
      fontSize: 11
    }
  },
  line: {
    style: {
      stroke: datum => datum.color,
      lineWidth: 2
    }
  }
};

registerTimelineChart();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Extension Chart: Timeline Chart](/vchart/guide/tutorial_docs/Chart_Extensions/timeline)
