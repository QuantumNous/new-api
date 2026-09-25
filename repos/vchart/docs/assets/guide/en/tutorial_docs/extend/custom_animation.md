# Custom Animation

Previously, we introduced how to configure basic animations and animation arrangements in VChart. In addition, if you have more specific needs or better animation ideas, you can achieve them through the ability to customize animations. Custom animation methods can be used not only in VChart, but also in the entire VisActor series of visualization solutions.

This chapter will introduce how to customize animations in VChart, including custom animation attribute interpolation functions and custom animation classes. Before you begin, please make sure you are familiar with and can use VChart's basic chart animation capabilities. In the last section ([Complex Animation Configuration and Choreography](../Animation/Configuration_and_Choreography_of_Complex_Animations)), we introduced the concept of TimeSlice, each TimeSlice can define multiple animation effects (`effect`), and we will focus on `effect.custom` to introduce custom animation methods.

## Custom Animation Attribute Interpolation Function

Custom animation attribute interpolation functions are mainly used to provide visual channels before and after the animation is executed to achieve some animation effects. `effect.custom` can be configured as a custom interpolation function:

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

You need to create an animation function that implements the `IAnimationChannelInterpolator` type, with the following function parameters:

- `ratio`: The progress ratio of the animation, a decimal value between 0 and 1.
- `from`: The visual channel attribute of the graphic element at the start of the animation.
- `to`: The visual channel attribute of the graphic element at the start of the animation.
- `nextAttributes`: The attribute values for the next frame, which can be calculated and modified in the function.
- `datum`: The original data associated with the current graphic element.
- `element`: The current graphic element.
- `parameters`: Custom animation parameters that can be passed when creating the animation.

Here is an example of a custom animation:

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

## Custom Animation Class

In VChart, custom animations are accomplished by implementing the `ICustomAnimate` interface. The following is the definition of the `ICustomAnimate` interface:

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

The interface defines some basic animation properties and lifecycle functions that can be used to create, update, and destroy custom animations. Detailed documentation can be found in [VRender Custom Animation](../../../../vrender/guide/asd/Basic_Tutorial/Events_and_Animation).

The following example uses the built-in `StreamLight` custom animation class from `VRender` to implement the bar chart streamer effect:

```javascript livedemo
// import { StreamLight } from '@visactor/vrender-core';
// if you need use `StreamLight` animation, please import it from @visactor/vrender-core.

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

### Writing Your Own Custom Animation Class

In VChart, you can inherit the ACustomAnimate class to write your own custom animation class. For example, the following code writes an animation that translates a column from a certain point.

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

Then pass this class to the custom field of the custom function in the spec

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
