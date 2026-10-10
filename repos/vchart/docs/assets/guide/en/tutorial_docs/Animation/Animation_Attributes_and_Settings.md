# Animation Properties and Configurations

When creating charts with VChart, we often want to add animation effects to the basic graphic elements to enhance user experience and attractiveness. VChart offers rich animation configuration options, including animation duration, delay duration, easing effects, and one-by-one execution. This tutorial will provide an in-depth introduction to the application methods and configuration instances of these animation properties.

## Animation Configuration

### Animation Duration

In VChart, the animation duration refers to the time it takes for the chart animation to go from start to finish, measured in milliseconds. We can use the `animationAppear.duration` property to set the duration for the chart's entrance animation, with a default value of 1000 (1 second). For example, if we want to set the animation duration of a bar chart to 1.5 seconds, the code is as follows:

```json
{
  "animationAppear": {
    "duration": 1500
  }
}
```

### Animation Delay Duration

Sometimes we want the chart to appear and then start playing the animation after a period of time. In this case, we can use the `animationAppear.delay` property to set the duration of the animation delay, also measured in milliseconds, with a default value of 0. For example, if we want the bar chart to start playing the animation 2 seconds after the page is loaded, we can set it as follows:

```json
{
  "animationAppear": {
    "duration": 1500,
    "delay": 2000
  }
  // ...other chart configuration information
}
```

```javascript livedemo
const spec = {
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
  xField: 'month',
  yField: 'sales',
  animationAppear: {
    duration: 1500,
    delay: 2000
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Animation Easing Effect

Easing effects describe the process of "acceleration" of the animation. Setting the appropriate easing effect can make the chart animation more dynamic. VChart has many built-in easing effect types that can be selected through the `animation.easing` property. The default value is `cubicOut`. The following built-in easing effect types are available, and you can refer to the [easing demo](../../../demo/combination/easing-visualization) for more information.

- linear
- quadIn
- quadOut
- quadInOut
- cubicIn
- cubicOut
- cubicInOut
- quartIn
- quartOut
- quartInOut
- quintIn
- quintOut
- quintInOut
- backIn
- backOut
- backInOut
- circIn
- circOut
- circInOut
- bounceOut
- bounceIn
- bounceInOut
- elasticIn
- elasticOut
- elasticInOut

For example, if you want the bar chart animation to use the `bounceOut` easing effect:

```json
{
  "animationAppear": {
    "easing": "bounceOut"
  }
  // ...other chart configuration information
}
```

```javascript livedemo
const spec = {
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
  xField: 'month',
  yField: 'sales',
  animationAppear: {
    easing: 'bounceOut'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### One by One Execution

In charts composed of multiple graphic elements, we sometimes want these elements to execute their animations one after another, rather than concurrently. We can use the `animationAppear.oneByOne` property to set this feature. The default value is `false`, meaning all graphic elements start their animations at the same time. Setting it to `true` will make the graphic elements play their animations in a round-robin fashion. If set to a number, a corresponding delay duration will be added between each consecutive graphic element. For example, to set a one-by-one animation effect for each bar in a bar chart:

```json
{
  "animationAppear": {
    "easing": "bounceOut",
    "oneByOne": 30
  }
  // ...other chart configuration information
}
```

```javascript livedemo
const spec = {
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
  xField: 'month',
  yField: 'sales',
  animationAppear: {
    easing: 'bounceOut',
    oneByOne: 1000
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

If you want to disable animations, you can directly configure `spec.animation: false`, or configure it when creating the chart instance:

```js
const vchart = new VChart(specs[0], { dom: CONTAINER_ID, animation: false });
```

We have now learned how to set animation duration, delay duration, easing effects, and one-by-one execution for charts in VChart. In practical applications, we can flexibly combine these properties according to specific requirements to present more elegant and dynamic chart animation effects to users.
