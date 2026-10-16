---
category: examples
group: component
title: Clock Example
keywords: gauge,comparison,circle,indicator
order: 0-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gauge-chart/clock.gif
option: gaugeChart
---

# Clock Example

A comprehensive application of `gaugePointer`, `gauge`, `radar` and other series, where the `gaugePointer` series represents the hands of the clock.

## Demo source

```javascript livedemo template=openinula-vchart
const getClockData = () => {
  const date = new Date();
  const s = date.getSeconds();
  const m = date.getMinutes();
  const h = ((date.getHours() % 12) + m / 60) * 5;
  const time = date.getTime();
  return { s, m, h, time };
};

const formatDate = date => {
  const m = date.getMonth();
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

const palette = {
  darkest: '#383e65',
  dark: '#6287f8',
  light: '#73fffe',
  lighter: '#ff6e27',
  lightest: '#fbf665',
  axisLabel: '#ccc'
};

const root = document.getElementById(CONTAINER_ID);
const { VChart } = InulaVChart;
const { useState, useRef, useEffect } = Inula;

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const [pointerData1, setPointerData1] = useState([
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
  ]);

  const [pointerData2, setPointerData2] = useState([
    {
      type: 's',
      value: initS,
      length: 300
    }
  ]);

  const [segmentData, setSegmentData] = useState(
    Array(12)
      .fill(0)
      .map((_, i) => ({
        value: (12 - i) * 5,
        opacity: 0.4
      }))
  );

  const [galaxyData, setGalaxyData] = useState(getGalaxyData(initTime));

  let tempSecond = -1;
  const update = () => {
    if (!chartRef.current) {
      return;
    }

    const { s, m, h, time } = getClockData();
    if (s !== tempSecond) {
      tempSecond = s;
      setPointerData1([
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
      setPointerData2([
        {
          type: 's',
          value: s,
          length: 300
        }
      ]);
      const highlightGaugeIndex = s % 3;
      setSegmentData(
        Array(12)
          .fill(0)
          .map((_, i) => ({
            value: (12 - i) * 5,
            opacity: i % 3 === 2 - highlightGaugeIndex ? 1 : 0.4
          }))
      );
    }
    setGalaxyData(getGalaxyData(time));
  };

  useEffect(() => {
    setInterval(update, 50);
  }, []);

  const spec = {
    type: 'common',
    width: 500,
    height: 500,
    background: 'black',
    theme: {
      colorScheme: {
        default: palette
      }
    },
    data: [
      {
        id: 'pointerData1',
        values: pointerData1
      },
      {
        id: 'pointerData2',
        values: pointerData2
      },
      {
        id: 'segmentData',
        values: segmentData
      },
      {
        id: 'galaxy',
        values: galaxyData
      }
    ],
    startAngle: -90,
    endAngle: 270,
    color: [palette.lighter, palette.light, palette.dark],
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
          segment: [
            {
              channel: ['fillOpacity'],
              duration: 600,
              easing: 'easeInOut'
            }
          ]
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
            fill: palette.lightest,
            cornerRadius: 100
          }
        },
        pin: {
          width: 0.13,
          height: 0.13,
          style: {
            fill: palette.dark,
            lineWidth: 0,
            fillOpacity: 0.5
          }
        },
        pinBackground: {
          width: 0.16,
          height: 0.16,
          style: {
            fill: palette.darkest
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
            fill: palette.axisLabel,
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
            stroke: palette.darkest,
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

  return <VChart ref={chartRef} spec={spec} />;
};

Inula.render(<Card />, root);

// release openinula instance, do not copy
window.customRelease = () => {
  Inula.unmountComponentAtNode(root);
};
```

## Related Tutorials

[Gauge Chart](link)
