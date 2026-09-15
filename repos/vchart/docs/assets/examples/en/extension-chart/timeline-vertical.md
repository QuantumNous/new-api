---
category: examples
group: extension chart
title: Timeline Chart - Vertical Layout
keywords: extension, timeline, vertical
order: 3
cover: /vchart/preview/timeline-vertical_2.0.jpeg
option: extensionChart
---

# Timeline Chart - Vertical Layout

Timeline charts support vertical layout with time flowing from top to bottom, suitable when there is sufficient horizontal space on the page.

## Key Configurations

- `direction: 'vertical'` Specifies vertical layout
- `labelPosition: 'left-right' | 'right-left'` Controls alternating display of labels on left and right sides

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
  direction: 'vertical',
  padding: {
    left: 200,
    right: 200,
    top: 60,
    bottom: 60
  },
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          id: '1',
          year: '2021 Q1',
          title: 'V1.0 Release',
          detail: 'First official version launched',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          year: '2021 Q3',
          title: 'V2.0 Upgrade',
          detail: '50% performance improvement',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          year: '2022 Q1',
          title: 'V3.0 Refactor',
          detail: 'Complete architecture upgrade',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          year: '2022 Q3',
          title: 'V4.0 Internationalization',
          detail: 'Multi-language support',
          time: 4,
          color: '#9B59B6'
        },
        {
          id: '5',
          year: '2023 Q1',
          title: 'V5.0 AI-Powered',
          detail: 'AI capabilities introduced',
          time: 5,
          color: '#E74C3C'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Product Version Iteration History',
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
      labelPosition: 'left-right',
      dotLabelGap: 10,
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
