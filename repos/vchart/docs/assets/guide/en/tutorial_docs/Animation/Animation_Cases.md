# Common Animation Cases

## Bar Chart Carousel Animation

Below is a demo of a carousel animation for a bar chart. The configuration defines the normal-state animation (`animationNormal`) for the bar chart element (`bar`). The key features of the content are explained below:

- `startTime`: The animation starts running at 350 milliseconds.
- `oneByOne`: The execution time interval for each bar is 200 milliseconds.
- `loop`: Animation loop playback is enabled.
  Next, we will introduce the contents of the TimeLine array in detail. This array contains two time slices, which are used to control the animation effects of the bar chart appearing on the screen and disappearing off the screen:

First time slice:

- `delay`: Animation delay time is 1000 milliseconds.
- `effects`: Animation effect configuration
  - `type`: Animation effect type is "growHeightOut" (bar height gradually decreases to disappear)
  - `easing`: Animation easing function is "bounceOut" (bouncing easing, more dynamic)
  - `options`: Optional parameters
    - `orient`: Animation direction is "negative" (negative direction, from bottom to top)
- `duration`: Animation duration is 300 milliseconds.

- Second time slice
- `delay`: Animation delay time is 1000 milliseconds.
- `effects`: Animation effect configuration
  - `type`: Animation effect type is "growHeightIn" (bar height gradually increases to display)
  - `easing`: Animation easing function is "bounceOut" (bounce easing)
  - `options`: Optional parameters
    - `orient`: Animation direction is "negative" (moving in the negative direction, from bottom to top)
- `duration`: Animation duration is 1200 milliseconds.

```javascript livedemo
const spec = {
  background: 'black',
  height: 300,

  color: ['#4D96FF', '#6BCB77', '#FFD93D', '#FF6B6B', '#53E0FF'],
  type: 'bar',
  data: {
    id: 'data2',
    values: [
      { x: 0, y: 90 },
      { x: 1, y: 115 },
      { x: 2, y: 130 },
      { x: 3, y: 125 },
      { x: 4, y: 200 }
    ]
  },
  xField: 'x',
  yField: 'y',
  seriesField: 'x',
  bar: {
    style: {
      fillOpacity: 0,
      cornerRadiusTopLeft: 4,
      cornerRadiusTopRight: 4
    }
  },
  animationAppear: {
    bar: [
      {
        oneByOne: 200,
        timeSlices: [
          {
            effects: {
              channel: {
                fillOpacity: { from: 0, to: 1 }
              }
            },
            duration: 0
          },
          {
            effects: {
              type: 'growHeightIn',
              easing: 'bounceOut',
              options: {
                orient: 'negative'
              }
            },
            duration: 1500
          }
        ]
      }
    ]
  },
  animationNormal: {
    bar: [
      {
        startTime: 350,
        oneByOne: 200,
        loop: true,
        timeSlices: [
          {
            delay: 1000,
            effects: {
              type: 'growHeightOut',
              easing: 'bounceOut',
              options: {
                orient: 'negative'
              }
            },
            duration: 300
          },
          {
            delay: 1000,
            effects: {
              type: 'growHeightIn',
              easing: 'bounceOut',
              options: {
                orient: 'negative'
              }
            },
            duration: 1200
          }
        ]
      }
    ]
  },
  tooltip: {
    visible: false
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Pie Chart Carousel Animation

Below is a demo of a carousel animation for a pie chart. We have configured the normal-state animation (`animationNormal`) for the `pie` chart element. We have defined two timelines:

- The first timeline (TimeLineA) starts running 100 milliseconds after the chart enters the scene and does not loop.
  - TimeLineA defines a time slice for executing a transparency-reducing animation with a duration of 500 milliseconds.
- The second timeline (TimeLineB) starts running 800 milliseconds later and is executed in a loop. The `oneByOne` attribute is set to true, indicating that the animation of each element starts after the previous element's animation is completed.
  TimeLineB defines 3 time slices:
  - Transparency recovers and the outer radius of the element expands by 10 px for emphasis, with an animation duration of 500 milliseconds;
  - The element properties remain unchanged for 500 milliseconds;
  - The element attributes are restored with a duration of 500 milliseconds.

```javascript livedemo
const spec = {
  type: 'pie',
  background: 'black',
  color: ['#4D96FF', '#6BCB77', '#FFD93D', '#FF6B6B'],
  data: [
    {
      name: 'data1',
      values: [
        {
          value: 300,
          name: 'A',
          radius: 100
        },
        {
          value: 120,
          name: 'B',
          radius: 95
        },
        {
          value: 100,
          name: 'C',
          radius: 90
        },
        {
          value: 80,
          name: 'D',
          radius: 85
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'name',
  seriesField: 'name',
  radius: 0.8,
  innerRadius: 0.5,
  startAngle: -90,
  endAngle: 250,
  pie: {
    style: {
      outerRadius: datum => {
        return datum.radius;
      },
      innerRadius: datum => {
        return 60;
      },
      cornerRadius: 2
    }
  },
  animationNormal: {
    pie: [
      {
        startTime: 100,
        loop: 0,
        timeSlices: [
          {
            effects: {
              channel: {
                fillOpacity: { to: 0.3 }
              }
            },
            duration: 500
          }
        ]
      },
      {
        loop: true,
        startTime: 800,
        oneByOne: true,
        timeSlices: [
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 },
                outerRadius: { to: datum => datum.radius + 10 }
              }
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 },
                outerRadius: { to: datum => datum.radius + 10 }
              },
              easing: 'linear'
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 0.3 },
                outerRadius: { to: datum => datum.radius }
              }
            },
            duration: 500
          }
        ]
      }
    ]
  },
  tooltip: {
    visible: false
  },
  indicator: {
    id: 'indicator',
    visible: true,
    fixed: true,
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          text: 'Number',
          fill: 'white',
          fillOpacity: 0.8,
          fontWeight: 600
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Top 10 Bar Chart Animation

Below is a demo of a dynamic ranking bar chart animation. In this example, we have configured the update animation for the `bar` chart element. This configuration defines two animation effects, which are:

1. Update animation (for all attributes except the element position visual channels `x`, `y`), with a duration of 2000 ms and a linear easing function `linear`;
2. The change of position visual channels `x`, `y` has a duration of 300 ms, also using the linear easing function `linear`.

```javascript livedemo
const goldenMedals = {
  2000: [
    { country: 'USA', value: 37 },
    { country: 'Russia', value: 32 },
    { country: 'China', value: 28 },
    { country: 'Australia', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 13 },
    { country: 'Italy', value: 13 },
    { country: 'Netherlands', value: 12 },
    { country: '古巴', value: 11 },
    { country: 'U.K.', value: 11 }
  ],
  2004: [
    { country: 'USA', value: 36 },
    { country: 'China', value: 32 },
    { country: 'Russia', value: 28 },
    { country: 'Australia', value: 17 },
    { country: 'Japan', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 11 },
    { country: 'Italy', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'U.K.', value: 9 }
  ],
  2008: [
    { country: 'China', value: 48 },
    { country: 'USA', value: 36 },
    { country: 'Russia', value: 24 },
    { country: 'U.K.', value: 19 },
    { country: 'Germany', value: 16 },
    { country: 'Australia', value: 14 },
    { country: 'South Korea', value: 13 },
    { country: 'Japan', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'France', value: 7 }
  ],
  2012: [
    { country: 'USA', value: 46 },
    { country: 'China', value: 39 },
    { country: 'U.K.', value: 29 },
    { country: 'Russia', value: 19 },
    { country: 'South Korea', value: 13 },
    { country: 'Germany', value: 11 },
    { country: 'France', value: 11 },
    { country: 'Australia', value: 8 },
    { country: 'Italy', value: 8 },
    { country: 'Hungary', value: 8 }
  ],
  2016: [
    { country: 'USA', value: 46 },
    { country: 'U.K.', value: 27 },
    { country: 'China', value: 26 },
    { country: 'Russia', value: 19 },
    { country: 'Germany', value: 17 },
    { country: 'Japan', value: 12 },
    { country: 'France', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'Australia', value: 8 }
  ],
  2020: [
    { country: 'USA', value: 39 },
    { country: 'China', value: 38 },
    { country: 'Japan', value: 27 },
    { country: 'U.K.', value: 22 },
    { country: 'Russian Olympic Committee', value: 20 },
    { country: 'Australia', value: 17 },
    { country: 'Netherlands', value: 10 },
    { country: 'France', value: 10 },
    { country: 'Germany', value: 10 },
    { country: 'Italy', value: 10 }
  ]
};
const dataSpecs = Object.keys(goldenMedals).map(year => {
  return {
    data: [
      {
        id: 'id',
        values: goldenMedals[year].sort((a, b) => b.value - a.value)
      },
      {
        id: 'year',
        values: [{ year }]
      }
    ]
  };
});
const duration = 2000;
const spec = {
  type: 'bar',
  padding: {
    top: 12,
    right: 100,
    bottom: 12
  },
  data: dataSpecs[0].data,
  direction: 'horizontal',
  yField: 'country',
  xField: 'value',
  seriesField: 'country',
  axes: [
    {
      animation: true,
      orient: 'bottom',
      type: 'linear',
      visible: true,
      grid: {
        visible: true
      }
    },
    {
      animation: true,
      id: 'axis-left',
      orient: 'left',
      width: 130,
      tick: { visible: false },
      label: { visible: true },
      type: 'band'
    }
  ],
  title: {
    visible: true,
    text: 'Top 10 Olympic Gold Medals by Country Since 2000'
  },
  animationUpdate: {
    bar: [
      {
        type: 'update',
        options: { excludeChannels: ['x', 'y'] },
        duration
      },
      {
        channel: ['x', 'y'],
        options: { excludeChannels: ['width'] },
        duration: 500
      }
    ],
    axis: {
      duration: 500,
      easing: 'linear'
    }
  },
  customMark: [
    {
      type: 'text',
      dataId: 'year',
      style: {
        textBaseline: 'bottom',
        fontSize: 200,
        textAlign: 'right',
        fontFamily: 'PingFang SC',
        fontWeight: 600,
        text: datum => datum.year,
        x: () => {
          return vchart.getChart().getCanvasRect()?.width - 50;
        },
        y: () => {
          return vchart.getChart().getCanvasRect()?.height - 50;
        },
        fill: 'grey',
        fillOpacity: 0.5
      }
    }
  ],
  player: {
    type: 'continuous',
    orient: 'bottom',
    auto: true,
    loop: true,
    dx: 80,
    position: 'middle',
    interval: duration,
    specs: dataSpecs,
    slider: {
      railStyle: {
        height: 6
      }
    },
    controller: {
      backward: {
        style: {
          size: 12
        }
      },
      forward: {
        style: {
          size: 12
        }
      },
      start: {
        order: 1,
        position: 'end'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
