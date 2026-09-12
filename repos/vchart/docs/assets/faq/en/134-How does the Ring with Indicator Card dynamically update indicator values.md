# How does the Ring with Indicator Card dynamically update indicator values?

## Question Description

Something like (https://www.visactor.io/vchart/demo/pie-chart/pie-indicator) for a ring with indicator cards.

The value in this metrics card is now user-defined and does not support automatic changes, but it is possible to update this value after calculation. Can this number in the metrics card be changed according to the sector of the hover? How to do it?

## Solution

The solution is different for different charting libraries. According to the demo you gave, you only need to set the interaction trigger type and configure the text field content.

- indicator.trigger is used to set the interaction trigger type. The available interaction types are hover, select, none, the default interaction trigger type is select, according to your requirement, you need to set indicator.trigger to hover.
- indicator.title.style.text is used to set the text content and supports callback. You can configure the required fields in the text according to the required data fields and format the presentation according to your needs.

## Code Example

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10,
      texture: datum => datum['texture']
    },
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
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: datum => {
          const d = datum ?? data[0];
          return d['formula'];
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          fill: 'orange',
          fontWeight: 'bolder',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['type'];
          }
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          fill: 'orange',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['value'] + '%';
          }
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Results

- [Online demo](https://codesandbox.io/s/pie-chart-with-indicator-card-4ypr2k)

## Quote

- [Pie Chart with Indicator Card Demo](https://www.visactor.io/vchart/demo/bar-chart/stack-column)
- [Indicator Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Indicator)
- [Related api](https://www.visactor.io/vchart/option/pieChart#indicator)
- [github](https://github.com/VisActor/VChart)
