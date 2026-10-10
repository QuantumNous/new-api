---
category: examples
group: extension chart
title: Timeline Chart - With Icons
keywords: extension, timeline, icon
order: 2
cover: /vchart/preview/timeline-icon_2.0.jpeg
option: extensionChart
---

# Timeline Chart - With Icons

Timeline charts support adding icons to event nodes, making information display more intuitive and rich. Icons can be displayed symmetrically with titles relative to the timeline.

## Key Configurations

- `iconField` Specifies the icon field
- `icon.style` Configures icon style
- Icons are symmetric with titles relative to the timeline: when title is above, icon is below; when title is on left, icon is on right

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
    top: 120,
    bottom: 120
  },
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          id: '1',
          year: '2021',
          title: 'Product Launch',
          detail: 'Released first generation product with market recognition',
          icon: 'star',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          year: '2022',
          title: 'Tech Breakthrough',
          detail: 'Achieved major breakthrough in core technology',
          icon: 'triangleUp',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          year: '2023',
          title: 'Market Expansion',
          detail: 'Business coverage extended to major cities nationwide',
          icon: 'diamond',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          year: '2024',
          title: 'Globalization',
          detail: 'Entered international market, opening new chapter',
          icon: 'cross',
          time: 4,
          color: '#9B59B6'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Corporate Development History - With Icons',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    }
  },
  series: [
    {
      type: 'event',
      dataId: 'timeline-data',
      timeField: 'time',
      eventField: 'title',
      subTitleField: 'detail',
      iconField: 'icon',
      labelPosition: 'top-bottom',
      dot: {
        style: {
          size: 10,
          fill: datum => datum.color,
          stroke: '#fff',
          lineWidth: 2
        }
      },
      icon: {
        visible: true,
        style: {
          size: 24,
          fill: datum => datum.color
        }
      },
      title: {
        style: {
          fill: '#333',
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      subTitle: {
        style: {
          fill: '#666',
          fontSize: 12,
          lineHeight: 18
        }
      },
      line: {
        style: {
          stroke: '#c0c3c7',
          lineWidth: 2
        }
      }
    }
  ]
};

registerTimelineChart();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Extension Chart: Timeline Chart](/vchart/guide/tutorial_docs/Chart_Extensions/timeline)
