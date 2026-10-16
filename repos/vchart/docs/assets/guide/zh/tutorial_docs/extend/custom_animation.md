# 自定义动画

之前我们介绍了 VChart 中如何配置基础动画和动画编排。除此之外，如果你有更特别的需求，或是更棒的动画创意，可以通过自定义动画的能力来实现。自定义动画的方式不仅仅在 VChart 中可以使用，在整个 VisActor 系列的可视化解决方案中，你都能找到它的身影。

本章将会介绍如何在 VChart 中自定义动画，包括自定义动画属性插值函数和自定义动画类两种方法。在开始之前，请确保您已经熟悉了并能够使用 VChart 中的基本图表动画能力。在上一节（[复杂动画的配置与编排](../Animation/Configuration_and_Choreography_of_Complex_Animations)）中，我们介绍了时间片（TimeSlice）的概念，每个时间片都可以定义多个动画效果（`effect`），接下来，我们将围绕 `effect.custom` 来介绍自定义动画的方法。

## 自定义动画属性插值函数

自定义动画属性插值函数主要是提供设定动画执行前后的视觉通道，来实现一些动画效果。`effect.custom` 可以配置为一个自定义插值函数：

```ts
export type IAnimationChannelInterpolator = (
  ratio: number,
  from: any,
  to: any,
  nextAttributes: any,
  datum: any,
  element: IElement,
  parameters: IAnimationParameters
) => boolean | void;
```

您需要创建一个实现 `IAnimationChannelInterpolator` 类型的动画函数，函数参数如下：

- `ratio`：动画进行的进度比例，值为 0 到 1 之间的小数。
- `from`：动画开始时图元的视觉通道属性。
- `to`：动画开始时图元的视觉通道属性。
- `nextAttributes`：下一帧的属性值，可以在函数里进行计算和修改。
- `datum`：与当前图形元素相关的原始数据。
- `element`：当前图形元素。
- `parameters`：自定义动画参数，可以在创建动画时传递。

以下是一个自定义动画的示例：

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
        segment: [
          {
            channel: ['fillOpacity'],
            duration: 1000,
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

## 自定义动画类

在 VChart 中，自定义动画是通过实现 `ICustomAnimate` 接口来完成的。以下是 `ICustomAnimate` 接口的定义：

```ts
export interface ICustomAnimate {
  duration: number;
  easing EasingType;
  step?: IStep;
  mode?: AnimateMode;

  bind: (target IAnimateTarget, subAni: ISubAnimate => void;
  onBind: () => void;
  onRun: () => void;
  onStart: () => void;
  onEnd: () => void;
  onUpdate: (end: boolean, ratio: number, out: Record<string, any>) => void;
  update (end: boolean, ratio: number, out: Record<string, any>) => void;
  getEndProps: () => Record<string, any> | void;
  getFromProps: () => Record<string, any> | void;
  MergedEndProps: () => Record<string, any> | void;
}
```

接口中定义了一些动的基本属性和生命周期函数，可以用于自定义动画的创建、更新和销毁等。详细文档可以参考[VRender 自定义动画](TODO)。

下面的例子使用了 `VRender` 内置 `StreamLight` 的自定义动画类，来实现的柱状图流光特效：

```javascript livedemo
// import { StreamLight } from '@visactor/vrender-core';
// 如果你需要使用 `StreamLight` 动画，请从 @visactor/vrender-core 中导出并使用。

const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar-data ',
      values: [
        { x: '283', y: '0', y2: '0', type: 'A', type2: 'A' },
        { x: '191', y: '1', y2: '0', type: 'A', type2: 'A' },
        { x: '280', y: '2', y2: '0', type: 'A', type2: 'A' },
        { x: '79', y: '3', y2: '0', type: 'A', type2: 'A' },
        { x: '36', y: '4', y2: '0', type: 'A', type2: 'A' },
        { x: '255', y: '0', y2: '0', type: 'B', type2: 'D' },
        { x: '213', y: '1', y2: '0', type: 'B', type2: 'D' },
        { x: '285', y: '2', y2: '0', type: 'B', type2: 'D' },
        { x: '263', y: '3', y2: '0', type: 'B', type2: 'D' },
        { x: '20', y: '4', y2: '0', type: 'B', type2: 'D' }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'x',
  yField: ['y', 'type'],
  seriesField: 'type',
  axes: [
    { orient: 'left', type: 'band' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ],
  animationNormal: {
    bar: {
      loop: 100,
      duration: 1500,
      easing: 'quadIn',
      custom: VRender.StreamLight,
      customParameters: {
        attribute: {
          fillColor: 'white',
          opacity: 0.6,
          blur: 5,
          shadowColor: 'white',
          width: 20
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### 编写自己的自定义动画类

在 VChart 中，可以继承`ACustomAnimate`类来实现编写自己的自定义动画类，例如下面代码，编写了一个柱子从某个点 translate 的动画

```ts
import { ACustomAnimate, EasingType } from '@visactor/vrender-core';
export class BarFromPoint extends ACustomAnimate<{ y?: number; y1?: number; x?: number; x1?: number }> {
  constructor(
    from: { y?: number; y1?: number; x?: number; x1?: number },
    to: { y?: number; y1?: number; x?: number; x1?: number },
    duration: number,
    easing: EasingType,
    params: any
  ) {
    const f = {
      y: from.y1,
      y1: from.y1,
      x: from.x1,
      x1: from.x1
    };
    super(f, { y: from.y, y1: from.y1, x: from.x, x1: from.x1 }, duration, easing, params);
  }

  getEndProps(): Record<string, any> {
    return this.to;
  }

  getFromProps(): void | Record<string, any> {
    return this.from;
  }

  onBind(): void {
    this.target && this.target.setAttributes(this.from);
  }

  onUpdate(end: boolean, ratio: number, out: Record<string, any>): void {
    const { x: fromX, y: fromY } = this.params.from;
    const { x: toX, y: toY, y1: toY1 } = this.to;
    const height = toY1! - toY!;
    out.x = fromX + (toX! - fromX) * ratio;
    out.y = fromY + (toY! - fromY) * ratio;
    out.y1 = out.y + height;
  }
}
```

然后将这个类传入 spec 中自定义函数的 custom 字段即可

```ts
{
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  animationAppear: {
    bar: {
      channel: ['x', 'y', 'x1', 'y1', 'width', 'height', 'cornerRadius'],
      custom: BarFromPoint,
      duration: 1000,
      easing: 'linear',
      customParameters: {
        from: {x: 0, y: 0},
      }
    },
  },
  xField: 'month',
  yField: 'sales'
}
```
