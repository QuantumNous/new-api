---
category: demo
group: title
title: Customize Style Title
keywords: title
order: 24-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/title/style-title.png
option: lineChart#title
---

# Customize Style Title

The title style supports customization.

## Key Configuration

- `textStyle` property declares the main title style. It can be used to configure various text settings such as text fill, text trim, text underline, text font, text size, etc.
- `subtextStyle` property declares the subtitle style. It can be used to configure various text settings such as text fill, text trim, text underline, text font, text size, etc.
- `align` property declares the horizontal text alignment, supporting three alignment methods `'left' | 'center' | 'right'`.
- `verticalAlign` property declares the vertical text alignment, supporting three alignment methods `'top' | 'middle' | 'bottom'`.

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  title: {
    visible: true,
    text: 'line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.',
    align: 'left',
    verticalAlign: 'top',
    textStyle: {
      stroke: '#333',
      lineWidth: 3,
      fill: '#468DFF',
      fontSize: 24
    },
    subtextStyle: {
      visible: true,
      fontStyle: 'italic',
      underline: 1
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach the links to tutorials or API documentation that are related to this demo configuration.
