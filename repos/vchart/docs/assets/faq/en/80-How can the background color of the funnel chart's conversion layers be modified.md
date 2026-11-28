# How can the background color of the funnel chart's conversion layers be modified?

## Question Description

The conversion layers in a funnel chart are used to depict the transition process between different stages or steps.
By default, the background color of the conversion layers in a funnel chart is usually set to a single color. How can the background color of the funnel chart's conversion layers be modified to enhance visualization and readability?

## Solution

VChart's funnel chart already provides the corresponding functionality that allows users to configure the mark style of the conversion layers in the `transform` configuration.
To change the background color of the funnel chart's conversion layers, you can modify the `transform.style.fill` configuration to adjust the background color of the conversion layers.

## Code Example

```javascript livedemo
const spec = {
  type: 'funnel',
  maxSize: '75%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  transform: {
    style: {
      fill: '#44b15920',
      lineWidth: 4,
      stroke: 'white'
    }
  },
  label: {
    visible: true
  },
  outerLabel: {
    visible: true,
    position: 'right',
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: '#000000'
    }
  },
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: 'Resume Screening',
          percent: 1
        },
        {
          value: 80,
          name: 'Resume Evaluation',
          percent: 0.8
        },
        {
          value: 50,
          name: 'Evaluation Passed',
          percent: 0.5
        },
        {
          value: 30,
          name: 'Interview',
          percent: 0.3
        },
        {
          value: 10,
          name: 'Final Pass',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Funnel Chart Transform Demo](https://visactor.io/vchart/demo/funnel-chart/rect-funnel?keyword=funnelChart)
- [Funnel Chart API](https://visactor.io/vchart/option/funnelChart#transform)
