---
category: examples
group: label
title: Bar Chart Labels
keywords: label
order: 35-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/label/bar-label.png
option: barChart#label
---

# Bar Chart Labels

In charts, labels are information annotations for the data currently displayed by the graphic and can be used to explain the meaning of some data in the graphic, such as values, names, etc.

## Key Configuration

To configure texture-related attributes on the graphics:

- `label`: Label configuration.
  - `visible`: Show label.
  - `style`: Label style configuration.
  - `position`: Label position configuration. In this example, the label is configured to be inside the graphic (`inside`).
  - `overlap`: Label overlap prevention configuration. In this example, two evasion strategies are configured for labels that are detected to collide:
    - `bound`: When the graphic size is not enough to accommodate the current label, try to place it in the alternative position within `position`, i.e., at the top of the graphic (`top`).
    - `moveY`: If there is not enough space for the current label, find the location in the y-axis based on the offset.

## Demo source

```javascript livedemo
const spec = {
  stack: true,
  data: [
    {
      name: 'allData',
      values: [
        {
          name: 'A',
          value: 0.12,
          group: '7+'
        },
        {
          name: 'B',
          value: 0.34,
          group: '7+'
        },
        {
          name: 'C',
          value: 0.25,
          group: '7+'
        },
        {
          name: 'D',
          value: 0.48,
          group: '7+'
        },
        {
          name: 'E',
          value: 0.55,
          group: '7+'
        },
        {
          name: 'F',
          value: 0.42,
          group: '7+'
        },
        {
          name: 'A',
          value: 0.23,
          group: '6-7'
        },
        {
          name: 'B',
          value: 0.25,
          group: '6-7'
        },
        {
          name: 'C',
          value: 0.18,
          group: '6-7'
        },
        {
          name: 'D',
          value: 0.19,
          group: '6-7'
        },
        {
          name: 'E',
          value: 0.15,
          group: '6-7'
        },
        {
          name: 'F',
          value: 0.12,
          group: '6-7'
        },
        {
          name: 'A',
          value: 0.31,
          group: '4-5'
        },
        {
          name: 'B',
          value: 0.33,
          group: '4-5'
        },
        {
          name: 'C',
          value: 0.4,
          group: '4-5'
        },
        {
          name: 'D',
          value: 0.24,
          group: '4-5'
        },
        {
          name: 'E',
          value: 0.18,
          group: '4-5'
        },
        {
          name: 'F',
          value: 0.2,
          group: '4-5'
        },
        {
          name: 'A',
          value: 0.56,
          group: '2-3'
        },
        {
          name: 'B',
          value: 0.29,
          group: '2-3'
        },
        {
          name: 'C',
          value: 0.15,
          group: '2-3'
        },
        {
          name: 'D',
          value: 0.01,
          group: '2-3'
        },
        {
          name: 'E',
          value: 0.14,
          group: '2-3'
        },
        {
          name: 'F',
          value: 0.16,
          group: '2-3'
        },
        {
          name: 'A',
          value: 0.15,
          group: '1'
        },
        {
          name: 'B',
          value: 0.11,
          group: '1'
        },
        {
          name: 'C',
          value: 0.015,
          group: '1'
        },
        {
          name: 'D',
          value: 0.02,
          group: '1'
        },
        {
          name: 'E',
          value: 0,
          group: '1'
        },
        {
          name: 'F',
          value: 0.05,
          group: '1'
        }
      ]
    }
  ],
  color: ['#009DB5', '#F0B71F', '#EB6F02', '#1E5273', '#3BA140'],
  label: {
    visible: true,
    position: 'inside',
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    overlap: {
      strategy: [
        {
          type: 'bound',
          position: ['top']
        },
        {
          type: 'moveY',
          offset: [-2, -4, -8, -10, -12]
        }
      ]
    }
  },
  type: 'bar',
  xField: 'name',
  yField: 'value',
  seriesField: 'group'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[Scatter Chart](link)
