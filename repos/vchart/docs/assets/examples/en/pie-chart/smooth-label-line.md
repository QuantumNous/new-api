---
category: examples
group: pie
title: Pie chart with smooth label lines
keywords: pieChart,comparison,composition,proportion,circle
order: 6-8
cover: /vchart/preview/pie-chart/smooth-label-line_1.4.0.png
option: pieChart
---

# Pie chart with smooth label lines

Pie Chart When setting the outer label, a guide line between the text label and the sector primitive will appear. The guide line defaults to a polyline, or it can be configured to smooth the curve.

## critical configuration

- `line.smooth` The property is used to control whether the label guide line is smooth, the default setting is`false`

## Code Demo

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      name: 'data1',
      values: [
        {
          value: 348,
          name: '中介渠道: 34.8%'
        },
        {
          value: 152,
          name: '会员: 15.2%'
        },
        {
          value: 500,
          name: '散客: 50%'
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'name',
  outerRadius: 0.8,
  innerRadius: 0.5,
  color: ['#87DBDD', '#FF8406', '#468DFF'],
  pie: {
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  legends: {
    visible: true,
    orient: 'right',
    title: {
      visible: false
    },
    item: {
      visible: true
    }
  },
  tooltip: {
    transitionDuration: 0
  },
  label: {
    visible: true,
    pickable: false,
    line: {
      smooth: true,
      style: {
        lineWidth: 2
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Pie chart](link)
