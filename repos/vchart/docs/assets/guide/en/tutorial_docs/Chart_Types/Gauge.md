# Gauge Chart

[\[Configuration Manual\]](../../../option/gaugeChart)

## Introduction

A gauge chart is a mimetic chart, just like the speedometer of a car, the scale represents the measurement, and the pointer angle represents the current value.

## Chart Composition

A gauge chart is composed of basic elements such as sector graphics and gauge pointers with progress directionality.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a03.png)

From a data series perspective, the gauge chart is encapsulated by the `gauge` and `gaugePointer` series, which draw the gauge dial sector area and pointer. By taking advantage of this feature, you can declare a gauge chart in a [Combined Chart](./combination) way to more flexibly adjust the gauge chart rendering effect.

Sector graphics and gauge pointers are basic elements of gauge charts, and related rendering configurations are essential:

- `gaugeChart.type`: Chart type, the type of gauge chart is `'gauge'`
- `gaugeChart.data`: Data source for chart rendering
- `gaugeChart.categoryField`: Classification field, mapping different sectors
- `gaugeChart.valueField`: Numeric field, mapping pointer angle
- `gaugeChart.innerRadius`: Specifies the inner radius of the gauge dial
- `gaugeChart.outerRadius`: Specifies the outer radius of the gauge dial
- `gaugeChart.startAngle`: Specifies the starting angle of the gauge dial
- `gaugeChart.endAngle`: Specifies the ending angle of the gauge dial

## Getting Started

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: '目标A',
          value: 0.6
        }
      ]
    }
  ],
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.5,
  startAngle: -180,
  endAngle: 0
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configuration

- The `categoryField` and `valueField` properties are used to specify the data category and pointer angle fields, respectively
- The `innerRadius` and `outerRadius` properties are used to specify the inner and outer radius of the gauge dial
- `startAngle` and `endAngle` properties are used to specify the starting and ending angles of the gauge dial

## Gauge Chart Features

### Data

- A `discrete` field, such as: `type`, indicates the data category, which can also be understood as the kind of progress item the gauge dial is displaying
- A `numeric` field, such as: `value`, indicates the pointer angle, which can also be understood as the progress value to be displayed

Since a gauge dial usually only displays one project's progress, the data typically only has one entry.

```ts
data: [
  {
    id: 'gauge',
    values: [
      {
        type: 'Target A',
        value: 0.6
      }
    ]
  }
];
```

### Declaring more flexible gauge charts in the form of combined charts

In order to make the gauge chart more mimetic, you can declare the `gauge` and `gaugePointer` series in the form of a combined chart and configure animations to dynamically display the progress effect.

The following example cleverly applies the current time as the source data, exquisitely fitting the dynamic dial effect, fully demonstrating the flexibility and practicality of VChart.

```javascript livedemo
const getClockData = () => {
  const date = new Date();
  const s = date.getSeconds();
  const m = date.getMinutes();
  const h = ((date.getHours() % 12) + m / 60) * 5;
  const time = date.getTime();
  return { s, m, h, time };
};

const formatDate = date => {
  let m = date.getMonth();
  let d = date.getDate();
  d = d < 10 ? '0' + d : d;
  const mString = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${d} ${mString[m]}`;
};
const dateString = formatDate(new Date());

const pointerAnimate = {
  custom: (ratio, from, to, nextAttributes) => {
    if ((!from.angle && from.angle !== 0) || (!to.angle && to.angle !== 0)) {
      return;
    }
    const toAngle = to.angle;
    const fromAngle = from.angle > to.angle ? from.angle - Math.PI * 2 : from.angle;
    nextAttributes.angle = ratio * (toAngle - fromAngle) + fromAngle;
  },
  easing: 'bounceOut'
};

const { s: initS, m: initM, h: initH, time: initTime } = getClockData();

const getGalaxyData = time => {
  return [
    {
      type: 1,
      angle: (time / 500) % 360,
      value: 100
    },
    {
      type: 2,
      angle: (time / 700) % 360,
      value: 150
    },
    {
      type: 3,
      angle: (time / 900) % 360,
      value: 200
    }
  ];
};

const spec = {
  type: 'common',
  width: 500,
  height: 500,
  background: 'black',
  theme: {
    colorScheme: {
      default: {
        palette: {
          darkest: '#383e65',
          dark: '#6287f8',
          light: '#73fffe',
          lighter: '#ff6e27',
          lightest: '#fbf665',
          axisLabel: '#ccc'
        }
      }
    }
  },
  data: [
    {
      id: 'pointerData1',
      values: [
        {
          type: 'm',
          value: initM,
          length: 250
        },
        {
          type: 'h',
          value: initH,
          length: 200
        }
      ]
    },
    {
      id: 'pointerData2',
      values: [
        {
          type: 's',
          value: initS,
          length: 300
        }
      ]
    },
    {
      id: 'segmentData',
      values: Array(12)
        .fill(0)
        .map((_, i) => ({
          value: (12 - i) * 5,
          opacity: 0.4
        }))
    },
    {
      id: 'galaxy',
      values: getGalaxyData(initTime)
    }
  ],
  startAngle: -90,
  endAngle: 270,
  color: [
    { type: 'palette', key: 'lighter' },
    { type: 'palette', key: 'light' },
    { type: 'palette', key: 'dark' }
  ],
  series: [
    {
      type: 'radar',
      dataIndex: 3,
      valueField: 'value',
      seriesField: 'type',
      categoryField: 'angle',
      outerRadius: 0.8,
      innerRadius: 0,
      point: {
        style: {
          lineWidth: 0,
          size: 10,
          fillOpacity: 0.8
        }
      },
      animation: false
    },
    {
      type: 'gauge',
      dataIndex: 2,
      valueField: 'value',
      seriesField: 'value',
      stack: true,
      outerRadius: 0.78,
      innerRadius: 0.6,
      padAngle: 2.29,
      segment: {
        style: {
          cornerRadius: 4,
          fillOpacity: datum => datum.opacity
        }
      },
      animationAppear: false,
      animationUpdate: {
        segment: {
          channel: ['fillOpacity'],
          duration: 1000,
          easing: 'easeInOut'
        }
      }
    },
    {
      type: 'gaugePointer',
      dataIndex: 0,
      valueField: 'value',
      seriesField: 'type',
      radiusField: 'length',
      pointer: {
        type: 'path',
        width: 0.5
      },
      pin: {
        visible: false
      },
      pinBackground: {
        visible: false
      },
      animationAppear: false,
      animationUpdate: {
        pointer: pointerAnimate
      }
    },
    {
      type: 'gaugePointer',
      dataIndex: 1,
      valueField: 'value',
      seriesField: 'type',
      pointer: {
        type: 'rect',
        width: 0.03,
        height: 0.88,
        center: [0.5, 0.25],
        style: {
          fill: { type: 'palette', key: 'lightest' },
          cornerRadius: 100
        }
      },
      pin: {
        width: 0.13,
        height: 0.13,
        style: {
          fill: { type: 'palette', key: 'dark' },
          lineWidth: 0,
          fillOpacity: 0.5
        }
      },
      pinBackground: {
        width: 0.16,
        height: 0.16,
        style: {
          fill: { type: 'palette', key: 'darkest' }
        }
      },
      animationAppear: false,
      animationUpdate: {
        pointer: pointerAnimate
      }
    }
  ],
  axes: [
    {
      visible: true,
      type: 'linear',
      orient: 'angle',
      radius: 0.8,
      min: 0,
      max: 60,
      domain: { visible: true, smooth: false },
      grid: {
        visible: false
      },
      tick: {
        visible: false,
        tickCount: 12
      },
      label: {
        style: {
          fontSize: 24,
          fontFamily: 'Times New Roman',
          fill: { type: 'palette', key: 'axisLabel' },
          text: ({ value }) => {
            if (!value) {
              return;
            }
            return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][value / 5];
          }
        }
      }
    },
    {
      visible: true,
      type: 'linear',
      orient: 'radius',
      min: 0,
      max: 250,
      outerRadius: 0.5,
      innerRadius: 0,
      label: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [],
          lineWidth: 18,
          stroke: { type: 'palette', key: 'darkest' },
          opacity: 0.65
        }
      },
      tick: {
        visible: false
      }
    }
  ],
  indicator: {
    visible: true,
    fixed: true,
    content: [
      {
        style: {
          fontSize: 18,
          fontFamily: 'Times New Roman',
          text: dateString.split(' ')[0],
          fill: 'white',
          fontWeight: 'bolder'
        }
      },
      {
        style: {
          fontSize: 18,
          fontFamily: 'Times New Roman',
          text: dateString.split(' ')[1],
          fill: 'white',
          fontWeight: 'bolder'
        }
      }
    ]
  },
  tooltip: {
    visible: false
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

let tempSecond = -1;
const update = () => {
  const { s, m, h, time } = getClockData();
  if (s !== tempSecond) {
    tempSecond = s;
    vchart.updateData('pointerData1', [
      {
        type: 'm',
        value: m,
        length: 250
      },
      {
        type: 'h',
        value: h,
        length: 200
      }
    ]);
    vchart.updateData('pointerData2', [
      {
        type: 's',
        value: s,
        length: 300
      }
    ]);
    const highlightGaugeIndex = s % 3;
    const segmentData = Array(12)
      .fill(0)
      .map((_, i) => ({
        value: (12 - i) * 5,
        opacity: i % 3 === 2 - highlightGaugeIndex ? 1 : 0.4
      }));
    vchart.updateData('segmentData', segmentData);
  }
  vchart.updateData('galaxy', getGalaxyData(time));
};

vchart.renderSync();
setInterval(update, 50);

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Graphics and Styles

#### Sector Gradient

In VChart, you can use `fill.gradient: 'conical'` to add a ring gradient effect to the graphics, which will improve the chart's expressiveness. Similarly, the sector graphic for the gauge chart is `progress`, so just configure `gaugeChart.progress.style.fill`, for specific configuration, please see [VChart Graphics Gradient Detailed Configuration](todo)

```javascript livedemo
const pointerPath =
  'M-0.020059 -0.978425 C-0.018029 -0.9888053 -0.013378 -1 0 -1 C0.01342 -1 0.01812 -0.989146 0.0201 -0.978425 C0.02161 -0.9702819 0.0692 -0.459505 0.09486 -0.184807 C0.10298 -0.097849 0.1089 -0.034548 0.11047 -0.018339 C0.11698 0.04908 0.07373 0.11111 0.00002 0.11111 C-0.07369 0.11111 -0.117184 0.04991 -0.110423 -0.018339 C-0.103662 -0.086591 -0.022089 -0.9680447 -0.020059 -0.978425Z';
const circlePath =
  'M1 0 C1 0.55228 0.55228 1 0 1 C-0.552285 1 -1 0.55228 -1 0 C-1 -0.552285 -0.552285 -1 0 -1 C0.55228 -1 1 -0.552285 1 0Z';

const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: '目标A',
          value: 0.6
        }
      ]
    }
  ],
  radiusField: 'type',
  angleField: 'value',
  seriesField: 'type',
  outerRadius: 0.8,
  innerRadius: 0.5,
  startAngle: -225,
  endAngle: 45,
  gauge: {
    type: 'circularProgress',
    progress: {
      style: {
        fill: {
          gradient: 'conical',
          stops: [
            {
              offset: 0,
              color: '#4FC6B4'
            },
            {
              offset: 1,
              color: '#31679E'
            }
          ]
        }
      }
    },
    track: {
      style: {
        fill: '#ccc'
      }
    }
  },
  pointer: {
    width: 0.5,
    height: 0.5,
    style: {
      path: pointerPath,
      fill: '#5A595E'
    }
  },
  pin: {
    style: {
      path: circlePath,
      fill: '#888'
    }
  },
  pinBackground: {
    width: 0.08,
    height: 0.08,
    style: {
      path: circlePath,
      fill: '#ddd'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
