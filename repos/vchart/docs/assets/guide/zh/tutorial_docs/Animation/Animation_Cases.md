# 常见动画案例

## 柱图轮播动画

下面是一个柱状图的轮播动画 demo，配置定义了柱状图元素（`bar`）的常态动画（`animationNormal`）。以下内容为关键部分的功能解释：

- `startTime`：动画开始执行的时间，本例中是 350 毫秒。
- `oneByOne`：每个柱子画的执行时间间隔，本例中为 200 毫秒。
- `loop`：动画循环播放开启。
  接下来，我们具体介绍 TimeLine 数组中的内容。这个数组包含着两个时间片，分别用于控制柱状图展示于屏幕和消失至屏幕的动画效果：

第一个时间片：

- `delay`：动画延迟时间为 1000 毫秒。
- `effects`：动画效果配置
  - `type`：动画效果类型为 "growHeightOut"（柱子高度逐渐减小至消失）
  - `easing`： 动画缓动函数为 "bounceOut"（弹跳缓动，更具动感）
  - `options`：可选参数
    - `orient`：动画方向为 "negative"（负方向进行，即从下到上）
- `duration`：动画持续时间为 300 毫秒。

- 第二个时间片
- `delay`：动画延迟时间为 1000 毫秒。
- `effects`：动画效果配置
  - `type`：动画效果类型为 "growHeightIn"（柱子高度逐渐增大至显示）
  - `easing`：动画缓动函数为 "bounceOut"（弹跳式缓动）
  - `options`：可选参数
    - `orient`：动画方向 "negative"（朝负方向进行，即从下到上）
- `duration`：动画持续时间为 1200 毫秒。

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

## 环形图轮播动画

下面是一个环形图的轮播动画 demo，我们配置了 `pie` 图元的常态动画（`animationNormal`）。我们定义了两条时间线：

- 第一条时间线（TimeLineA）在图表入场动画 100 毫秒 后开始执行，并且不循环。
  - TimeLineA 上定义了一个时间片，用于执行一个透明度变小的动画，动画时长 500 毫秒；
- 第二条时间线（TimeLineB）在 800 毫秒 后开始执行，并且是循环执行的。oneByOne 属性设置为 true，表示每个元素的动画在上一个元素动画执行结束后开始执行。
  TimeLineB 上定义了 3 个时间片：
  - 透明度恢复，且图元外半径扩大 10 px，用于强调的效果，动画时长 500 毫秒;
  - 元素属性不变，维持 500 毫秒;
  - 元素属性恢复，时长 500 毫秒;

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

## Top 10 柱图动画

下面是一个动态排行柱图的动画 demo，在这个例子中，我们配置了柱状图 `bar` 图元的更新动画。这个配置定义了两个动画效果，分别是：

1. 更新动画（除了图元位置视觉通道`x`，`y`之外的其他属性），时长为 2000 ms，并线性缓动函数 `linear`;
2. 位置视觉通道`x`，`y`的变化时长为 300 ms，同样使用线性缓动函数 linear。

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
