---
category: examples
group: label
title: Line Chart Labels
keywords: label
order: 35-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/label/line-label.png
option: lineChart#label
---

# Line Chart Labels

In charts, labels are information annotations for the data currently displayed by the graphic, which can be used to explain some data meaning of the graphic, such as values, names, etc.

## Key Configuration

Configure the texture-related attributes on the shape:

- `label`: Label configuration.
  - `visible`: Display label.
  - `style`: Label style configuration.

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8,
        lowest: true
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
        value: 17,
        highest: true
      },
      {
        time: '14:00',
        value: 17,
        highest: true
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
  label: {
    visible: true,
    style: {
      visible: datum => !!(datum.highest || datum.lowest),
      fontWeight: 'bold',
      text: datum => `${datum.value}°C`,
      fill: datum => {
        if (datum.highest) {
          return 'red';
        }
        if (datum.lowest) {
          return 'rgb(51, 147, 246)';
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Scatter Plot](link)
