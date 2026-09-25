---
category: examples
group: line chart
title: Dashed Line at the End
keywords: lineChart, comparison, trend, line
order: 0-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/dash-line.png
option: lineChart
---

# Dashed Line at the End

The dashed line at the end of the line chart is mainly achieved through data identification and the `lineDash` style of the `line` graphic element.
When we want to distinguish a certain section of the data, we can set a special style for a part of the line segment to highlight this special point.
For example, in this case, a broken dashed line is used to indicate the estimated direction of the latest data of the fund's ups and downs.

## Key Configuration

- Set the `lineDash` style of the `line` graphic element to `lineDash: [5, 5]`

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      lineDash: data => {
        if (data.latest) {
          return [5, 5];
        }
        return [0];
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Key Configuration

None

## Related Tutorials

[Line Chart](link)
