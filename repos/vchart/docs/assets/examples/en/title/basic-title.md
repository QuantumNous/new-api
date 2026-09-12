---
category: demo
group: title
title: Basic Title
keywords: title
order: 24-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/title/basic-title.png
option: lineChart#title
---

# Basic Title

Composed of the main title and a subtitle, the subtitle is optional

## Key Configuration

- The `text` attribute declares the main title content
- The `subtext` attribute declares the subtitle content

## Live Demo

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
    text: 'line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach the links to the tutorials or API documentation related to the demo configuration.
