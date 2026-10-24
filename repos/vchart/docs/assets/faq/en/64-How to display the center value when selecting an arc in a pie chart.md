# How to display the center value when selecting an arc in a pie chart?

## Question Description

In a circular chart, there is a large amount of blank space in the center area, and I want to use these areas to display the numerical value corresponding to a sector in the middle of the chart when clicking on it.

## Solution

VChart has designed an indicator component for pie charts, supporting the configuration of indicator titles and multi-line text content.
It provides, fixed and hover two interaction modes, and commonly used style configuration functions.

## Code Example

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'data',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.6,
  innerRadius: 0.4,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.65
      },
      selected: {
        outerRadius: 0.65
      }
    }
  },
  label: {
    visible: true
  },
  indicator: {
    visible: true,
    trigger: 'fixed',
    title: {
      visible: true,
      style: {
        fontSize: 18,
        text: data => {
          if (data) {
            const value = data['type'];
            return value ? value : null;
          }
          return null;
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 18,
          text: ''
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          text: data => {
            if (data) {
              const value = data['value'];
              return value ? `${value}%` : null;
            }
            return null;
          }
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [Github](https://github.com/VisActor/VChart)
- [VChart Pie Chart Indicator Demo](https://visactor.io/vchart/demo/pie-chart/pie-indicator)
- [VChart Pie Chart Indicator API](https://visactor.io/vchart/option/pieChart#indicator.visible)
