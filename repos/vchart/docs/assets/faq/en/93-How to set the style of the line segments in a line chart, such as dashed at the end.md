# How to set the style of the line segments in a line chart, such as dashed at the end?

## Question Description

I have a line chart demand. In the chart, the last data point of the line is predicted data, so I want the last section of the line to be displayed as a dashed line, similar to the picture below. How can this be implemented more conveniently?  
![demo](/vchart/faq/19-0.png)

## Solution

I recommend VChart, and the official website demo has the effect you need: https://visactor.io/vchart/demo/line-chart/dash-line . It can return different styles based on the data in the callback of the line mark style.

- `lineDash`: Dashed mode. It uses a set of values to specify the alternating lengths of the lines and gaps that describe the pattern.

```js
line: {
  style: {
    stroke: (data) => data.latest ? 'blue': 'green',
    lineDash: data => data.latest ? [5, 5]: [0]
  }
},
point: {
  style: {
    fill: (data) => data.latest ? 'blue': 'green',
  }
}
```

## Code Example

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
      stroke: data => (data.latest ? 'blue' : 'green'),
      lineDash: data => (data.latest ? [5, 5] : [0])
    }
  },
  point: {
    style: {
      fill: data => (data.latest ? 'blue' : 'green')
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [More demos](https://visactor.io/vchart/demo/line-chart/dash-line)
- [Related API](https://visactor.io/vchart/option/lineChart#line.style)
- [github](https://github.com/VisActor/VChart)
