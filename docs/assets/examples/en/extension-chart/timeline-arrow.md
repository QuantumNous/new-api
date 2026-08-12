---
category: examples
group: extension chart
title: Timeline Chart - With Arrows
keywords: extension, timeline, arrow
order: 5
cover: /vchart/preview/timeline-arrow_2.0.jpeg
option: extensionChart
---

# Timeline Chart - With Arrows

Timeline charts support displaying arrows between event nodes, providing a more intuitive representation of time flow and continuity between events.

## Key Configurations

- `arrow.visible: true` Enable arrow display
- `arrow.thickness` Set the thickness of arrows
- `arrow.style` Configure arrow style

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
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          id: '1',
          title: 'Requirements',
          detail: 'Collect and analyze user needs',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          title: 'Design',
          detail: 'Create technical solution',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          title: 'Development',
          detail: 'Implement features',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          title: 'Testing',
          detail: 'Quality assurance',
          time: 4,
          color: '#9B59B6'
        },
        {
          id: '5',
          title: 'Release',
          detail: 'Go live',
          time: 5,
          color: '#2ECC71'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Project Development Process',
    subtext: 'Complete workflow from requirements to release',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    },
    subtextStyle: {
      fontSize: 14,
      fill: '#666'
    }
  },
  series: [
    {
      type: 'event',
      dataId: 'timeline-data',
      timeField: 'time',
      eventField: 'title',
      subTitleField: 'detail',
      labelPosition: 'top-bottom',
      dot: {
        style: {
          size: 12,
          fill: datum => datum.color,
          stroke: '#fff',
          lineWidth: 2
        }
      },
      arrow: {
        visible: true,
        thickness: 16,
        style: {
          fill: datum => datum.color,
          fillOpacity: 0.3
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
          fontSize: 12
        }
      },
      line: {
        visible: false
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
