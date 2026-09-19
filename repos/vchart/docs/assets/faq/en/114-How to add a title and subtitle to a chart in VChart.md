# How to add a title and subtitle to a chart in VChart?

## Question Description

Seemly to this [demo](https://visactor.io/vchart/demo/line-chart/basic-line), I want to add a title description to the chart. How can I configure it?

## Solution

In VChart, you only need to configure `title.text` and `title.subtext`.
In addition, you can configure the style of the title and subtitle separately by using `title.textStyle` and `title.subtextStyle`:

```js
title: {
    text: 'Line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.',
    textStyle: {
      fontSize: 20
    },
    subtextStyle: {
      fontStyle: 'italic'
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
        value: 17
      },
      {
        time: '12:00',
        value: 19
      },
      {
        time: '14:00',
        value: 19
      },
      {
        time: '16:00',
        value: 17
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
    text: 'Line chart',
    subtext:
      'The line chart is a simple, two-dimensional chart with an X and Y axis, each point representing a single value.',
    textStyle: {
      fontSize: 20
    },
    subtextStyle: {
      fontStyle: 'italic'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [More title demos](https://visactor.io/vchart/demo/title/richText-title)
- [Title tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Title)
- [Related api](https://visactor.io/vchart/option/lineChart#title.text)
- [github](https://github.com/VisActor/VChart)
