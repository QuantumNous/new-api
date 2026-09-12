---
category: examples
group: progress
title: Linear Progress Chart
keywords: linearProgress, comparison, rectangle
order: 16-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c81702.png
option: linearProgressChart
---

# Linear Progress Chart

The linear progress chart is a type of chart in the rectangular coordinate system. It can display the percentage values of multiple indicators side by side, making it suitable for assessing the progress of goal achievement.

## When to use

1. Show the progress of achieving goals.
2. Compare the progress of achieving goals in different categories.

## Key Configuration

- The `categoryField` and `valueField` properties are used to specify the data category and rectangle length fields, respectively

## Demo source

```javascript livedemo
const spec = {
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'type',

  cornerRadius: 20,
  bandWidth: 30,
  axes: [
    {
      orient: 'left',
      label: { visible: true },
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false }
    },
    { orient: 'bottom', label: { visible: true }, type: 'linear', visible: false }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Progress Chart](link)
