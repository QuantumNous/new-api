---
category: examples
group: histogram chart
title: Horizontal Stacked Histogram
keywords: histogram,distribution,rectangle,composition
order: 3-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-stack-h.png
option: histogramChart
---

# Horizontal Stacked Histogram

## Key option

- Declare the frequency statistics left interval field as the `xField` attribute
- Declare the frequency statistics right interval field as the `x2Field` attribute
- Declare the frequency value field as the `yField` attribute
- Declare the group field as the `seriesField` attribute
- Declare the chart direction field as the `direction` attribute; `horizontal` means horizontal direction, `vertical` means vertical direction

## Demo source

```javascript livedemo
const spec = {
  color: ['#1ac7c2', '#ccf59a'],
  type: 'histogram',
  xField: 'people',
  yField: 'age0',
  y2Field: 'age1',
  seriesField: 'sex',
  direction: 'horizontal',
  legends: {},
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'A trellis bar chart showing the US population distribution of age groups and gender in 2000.',
    textStyle: {
      height: 50,
      lineWidth: 2,
      fill: '#333',
      fontSize: 18,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: datum => datum['sex']
      },
      content: [
        {
          key: datum => datum['age0'] + '～' + datum['age1'],
          value: datum => datum['people']
        }
      ]
    }
  },
  axes: [
    {
      orient: 'bottom',
      nice: false
    }
  ],
  data: [
    {
      name: 'data1',
      values: [
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9735380,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10552146,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10563233,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 10237419,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9731315,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9659493,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10205879,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11475182,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11320252,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 9925006,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8507934,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6459082,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5123399,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4453623,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 3792145,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 2912655,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 1902638,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 970357,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 336303,
          sex: 'Female'
        },
        {
          year: 2000,
          age0: 0,
          age1: 5,
          people: 9310714,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 5,
          age1: 10,
          people: 10069564,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 10,
          age1: 15,
          people: 10022524,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 15,
          age1: 20,
          people: 9692669,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 20,
          age1: 25,
          people: 9324244,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 25,
          age1: 30,
          people: 9518507,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 30,
          age1: 35,
          people: 10119296,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 35,
          age1: 40,
          people: 11635647,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 40,
          age1: 45,
          people: 11488578,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 45,
          age1: 50,
          people: 10261253,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 50,
          age1: 55,
          people: 8911133,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 55,
          age1: 60,
          people: 6921268,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 60,
          age1: 65,
          people: 5668961,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 65,
          age1: 70,
          people: 4804784,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 70,
          age1: 75,
          people: 5184855,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 75,
          age1: 80,
          people: 4355644,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 80,
          age1: 85,
          people: 3221898,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 85,
          age1: 90,
          people: 1981156,
          sex: 'Male'
        },
        {
          year: 2000,
          age0: 90,
          age1: 95,
          people: 1064581,
          sex: 'Male'
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
