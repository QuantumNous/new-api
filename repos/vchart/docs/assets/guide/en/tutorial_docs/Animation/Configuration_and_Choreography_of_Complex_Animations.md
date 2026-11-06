# Configuration and Arrangement of Complex Animations

In order to better support narrative visualization scenarios, VChart also supports the configuration of complex graphic animation and arrangement capabilities. Through the previous tutorial, we have a general understanding of the animation types and basic configurations defined in VChart. This section will further introduce the graphic animation capabilities of VChart.

In a chart series, there might be multiple graphic elements (for example, line charts have point elements and line elements). VChart supports configuring different animation effects for different graphic elements.

According to the need, if the graphic animation is configured as `false`, the animation of the corresponding graphic element can be turned off.

```json
"animationAppear": {
  "point": false
}
```

## Graphic Animation Configuration

First, let's look at a simple example. Here, we will create a folded column combination chart and configure an animation for it: the columns grow one by one, and when they are finished, all the points appear at the same time, and then the lines connect the points one by one.

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          oneByOne: true,
          duration: 500,
          totalTime: 3500
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          delay: 3500,
          duration: 500
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 4000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

In the above example, we are using the `duration`/`delay`/`easing`/`oneByOne` configuration introduced in our previous chapter ([Animation Types](./Animation_Types)) to achieve simple animation effects.

The animation configuration for graphic elements supports multiple properties for detailed control of the animation behavior. Here are the supported attributes for the graphic animation configuration:

- `type`: Animation type, using built-in animation types like "fadeIn", "fadeOut", etc.
- `channel`: Visual channel animation configuration, see the contents of the [Visual Channel Animation Configuration](#Visual Channel Animation Configuration)section.
- `delay`: The delay time for executing the animation, default is 0.
- `duration`: The duration of the animation execution, default is 1000ms (1 second).
- `oneByOne`: The delay time for the animations to execute one by one. If set to true, it will execute the next element's animation after the previous element's animation has completed, default is false.
- `startTime`: The initial time at which the animation is executed. This initial time will not be reapplied in loop animations, default is 0.
- `totalTime`: The maximum time for the animation to execute. It will be terminated if the animation execution reaches the set time limit.
- `loop`: The number of animation loops. If set to true, it will loop indefinitely.
- `options`: Additional parameters set for the specific animation type during execution.
  - `excludeChannels`: Visual channels that do not participate in the current animation;
- `controlOptions`: Control parameters for the animation execution logic:
  - `stopWhenStateChange`: Whether to immediately stop the animation when the animation state changes.
  - `imApply`: Whether to apply the initial visual channel of the animation immediately.

In the previous example, the column defaults to growth animation, the point element defaults to scale animation, and the line defaults to clip animation. What if we expect some other animation effects, like a fade-in effect for all graphic elements? How do we configure it? Next, we will introduce some built-in animation effects in VChart.

### Built-in Animation Types

In VChart, there are some built-in common animation types. These animation types can be used directly in the configuration to achieve common graphic animation effects. Common built-in animation types include:

- `fadeIn`/`fadeOut`: Fade-in and fade-out animations.
- `scaleIn`/`scaleOut`: Scaling animations.
- `moveIn`/`moveOut`: Move in and move out animations.
- `rotateIn`/`rotateOut`: Rotation animations.
- `update`: Update animation, commonly used for graphic update animations (`animationUpdate`).

#### Fade-in and Fade-out Animations

Fade-in animation is a common appearance animation: the opacity of the graphic element changes gradually from 0 to 1; the fade-out animation is just the opposite and is often used for the exit animation of the chart.
Based on the previous example, we add a new animation type configuration `type: 'fadeIn'` for all graphic elements and slightly adjust the animation delay (`delay`). From the following effect, we can see that the chart's entrance animation has changed to the fade-in animation we configured.

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'fadeIn', // 渐入动画
          oneByOne: true,
          duration: 500,
          totalTime: 3500
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'fadeIn', // 渐入动画
          duration: 500,
          delay: 3500
        },
        // 线图元动画配置
        line: {
          type: 'fadeIn', // 渐入动画
          duration: 1500,
          delay: 4000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Scaling Animations

Scaling animation is a common appearance animation: the `scaleX`/`scaleY` of the graphic element gradually changes from 0 to 1; the `scaleOut` animation is just the opposite and is often used for the exit animation of the chart.
VChart provides additional configuration parameters `options` for the built-in animation types `scaleIn`/`scaleOut`:

```ts
export interface IScaleAnimationOptions {
  direction?: 'x' | 'y' | 'xy';
}
```

Here, the direction attribute is used to specify the scaling direction, with optional values:

- 'x': Scale in the x direction.
- 'y': Scale in the y direction.
- 'xy': Scale in both x and y directions (default).

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'scaleIn',
          options: { direction: 'y' },
          duration: 1000
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      point: {
        style: {
          size: 20
        }
      },
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'scaleIn',
          delay: 1000,
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Move-in and Move-out Animations

Move-in and move-out animations are basic graphic element animations that involve the element moving in a certain direction. VChart provides the IMoveAnimationOptions interface to configure move-in and move-out animations.
VChart provides additional configuration parameters `options` for the built-in animation types `moveIn`/`moveOut`:

```ts
export interface IMoveAnimationOptions {
  direction?: 'x' | 'y' | 'xy';
  orient?: 'positive' | 'negative';
  offset?: number;
  point?: { x?: number; y?: number };
}
```

Here:

- `direction`: Moving direction, with optional values similar to scaling animation.
- `orient`: Moving direction, with optional values:
  - 'positive': Positive direction (default)
  - 'negative': Negative direction
- `point`: The starting point coordinates of the movement.
- `offset`: The distance of the movement (in pixels), default is the `(0,0)` coordinate of the current area.

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'moveIn',
          options: { direction: 'x' },
          duration: 1000
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'moveIn',
          options: { direction: 'y' },
          easing: 'bounceOut',
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

#### Rotation Animations

Rotation animation is a type of graphic animation provided for elements that are configured with the `angle` attribute. It is often used for graphic elements in polar coordinate systems, such as the pointer change animation in a gauge chart.
VChart provides additional configuration parameters `options` for the built-in animation types `rotateIn`/`rotateOut`:

```ts
export interface IRotateAnimationOptions {
  orient?: 'clockwise' | 'anticlockwise';
  angle?: number;
}
```

Here:

- `orient`: Rotation direction, with optional values:
  - 'clockwise': Clockwise direction (default)
  - 'anticlockwise': Counterclockwise direction
- `angle`: The rotation angle in radians.

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },
        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      point: {
        style: {
          shape: 'star',
          angle: 180,
          size: 20
        }
      },
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'rotateIn',
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

In addition, depending on the characteristics of different graphic elements, VChart also provides some exclusive graphic animation types.

#### Built-in Animations for Rectangle Elements

Rectangle elements are commonly used in bar charts and histograms. Rectangle elements support the following additional animation types:

- `growHeightIn`/`growHeightOut`: Height growth animation
- `growWidthIn`/`growWidthOut`: Width growth animation
- `growCenterIn`/`growCenterOut`: Center growth animation

#### Built-in Animations for arc Elements

Arc elements are commonly used in pie charts, rose charts, and ring progress charts. Graphic elements support the following additional animation types:

- `growRadiusIn`/`growRadiusOut`: Radius growth animation
- `growAngleIn`/`growAngleOut`: Angle growth animation

#### Built-in Animations for Line Elements

Line elements are commonly used in line charts and area charts. Graphic elements support the following additional animation types:

- `growPointsIn`/`growPointsOut`: Point growth animation
- `growPointsXIn`/`growPointsXOut`: X-direction point growth animation
- `growPointsYIn`/`growPointsYOut`: Y-direction point growth animation
- `clipIn`/`clipOut`: Clipping animation

### Visual Channel Animation Configuration

If you need to specify the specific change effect of graphic elements before and after the animation execution, for example, set the color transparency (fillOpacity) of the graphic element to change from 1 to 0.3 during the animation process. The visual channel animation configuration example is as follows:

```json
{
  "animationAppear"：{
    "bar"：{
        "channel": {
          "fillOpacity": { "from": 0.3, "to": 0.3 }
      }
    }
  }
}
```

`channel` configuration and `type` are mutually exclusive and cannot be configured simultaneously. When the built-in animation type (`type`) is configured, the `channel` configuration will not take effect.

### Animation Execution Control

## Animation Arrangement

VChart provides animation arrangement configuration based on JSON spec to meet as many animation requirements as possible.

### Timeline

A timeline represents the animation performance of a graphic element over a specific period of time. A timeline contains a set of serialized animation fragments (TimeSlice). The timeline describes the animation performance of a graphic element over a period of time. Animations in different timelines can be executed in parallel. The timeline can also be set with `loop: true` to loop the configured animation effects.

![Timeline schematic diagram](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/23e5d313c2c3a66d4ca)

### Timeslice

In a timeline, each time slice is executed serially, and the constituent elements in a time slice include:

- `effect`: The specific execution effect of the animation, which describes the specific interpolation calculation logic of the visual channel attributes of the primitive. Effects can be encapsulated specific animation effects, or animation configurations configured by developers to start and end states, and describe the calculation logic of animation attribute interpolation. Each timeSlice can be configured with multiple `effect`;
- `duration`: the execution duration of animation slices;
- `delay`: the waiting time before the execution of the animation slice;

### Animation Effect (Effect)

The constituent elements in animation effects (Effect) include:

- `channel`: the changed visual channel attribute, which describes the visual channel attribute when the interpolation calculation starts and ends;
- `easing`: easing strategy for difference calculation;

The following example achieves an accordion effect by animating a looping timeline:

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: [
        { x: '1', y: 22 },
        { x: '2', y: 43 },
        { x: '3', y: 33 },
        { x: '4', y: 22 },
        { x: '5', y: 10 },
        { x: '6', y: 30 },
        { x: '7', y: 46 },
        { x: '8', y: 21 },
        { x: '9', y: 33 },
        { x: '10', y: 43 },
        { x: '11', y: 42 },
        { x: '12', y: 30 },
        { x: '13', y: 9 },
        { x: '14', y: 46 }
      ]
    }
  ],
  xField: ['x'],
  yField: 'y',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orientation: 'left', type: 'linear' }
  ],
  animationNormal: {
    bar: [
      {
        loop: true,
        startTime: 100,
        oneByOne: 100,
        timeSlices: [
          {
            delay: 1000,
            effects: {
              channel: {
                fillOpacity: { to: 0.5 }
              },
              easing: 'linear'
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 }
              },
              easing: 'linear'
            },
            duration: 500
          }
        ]
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Custom animation

In the animation effect (Effect), if the simple `channel` configuration cannot meet your needs, you can configure custom animation effects through `custom` and `customParameters`:

- `custom`: custom animation;
- `customParameters`: Custom animation parameters;
  For detailed usage, please refer to the [Custom Animation](../extend/custom_animation) chapter.
