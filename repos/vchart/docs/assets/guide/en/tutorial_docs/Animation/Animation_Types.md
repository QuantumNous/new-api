# VChart Animation Tutorial

In this tutorial, we will go into detail on how to use animation features in VChart.

Animation is a non-critical feature in VChart, which can make the charts more vivid and easy to understand. In the following sections, we will learn about the types of animations and related configurations in VChart:

- Entrance animation
- Update animation
- Exit animation

## Entrance Animation Configuration

The entrance animation refers to the animation effect when the chart is created. We can use the `animationAppear` configuration to set the entrance animation.

The type of `animationAppear` can be either a boolean value or an object. When set to `false`, the entrance animation will be turned off. When set as an object, the characteristics of the entrance animation can be set. Here's an example configuration:

```json
{
  "animationAppear": {
    "duration": 1000, // Animation duration, in milliseconds (ms)
    "easing": "ease" // Animation easing effect
  }
}
```

## Data Update Animation Configuration

The attribute animation of chart elements when updating chart data is called an update animation. In VChart, users can manually call the `updateData` interface to trigger data updates. Also, clicking the legend will update the chart data. The update animation is divided into three categories: new element animation, element update animation, and exit element animation.
Usually, you don't need to consider how to control these three types of update animations, because VChart will recognize the relationship between new data and previous data when updating data, and perform update animations correctly.

Here's an example of a pie chart data update, where you can randomly update the pie chart's data length and value:

```javascript livedemo
const minDataLength = 1;
const maxDataLength = 4;

const randomDataValues = () => {
  const dataLength = Math.round(Math.random() * (maxDataLength - minDataLength)) + minDataLength;
  const values = [];
  for (let i = 0; i < dataLength; i++) {
    values.push({
      type: `${i}`,
      value: Math.random()
    });
  }
  return values;
};

const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: '1', value: Math.random() },
        { type: '2', value: Math.random() },
        { type: '3', value: Math.random() }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  tooltip: false
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
setInterval(() => {
  vchart.updateData('id0', randomDataValues());
}, 2000);
```

### New Element Animation

The new element animation refers to the animation effect of the new element added when the chart data is updated. We can use the `animationEnter` configuration to set the new element animation.

`animationEnter` can be either a boolean value or an object. When set to `false`, it will disable the new element animation. When set as an object, the characteristics of the new element animation can be set. Here's an example configuration:

```json
{
  "animationEnter": {
    "duration": 500, // Animation duration, in milliseconds (ms)
    "easing": "quadIn" // Animation easing effect
  }
}
```

### Element Update Animation

The element update animation refers to the update animation effect of the existing element when the chart data is updated. We can use the `animationUpdate` configuration to set the element update animation.

`animationUpdate` can be either a boolean value or an object. When set to `false`, it will disable the element update animation. When set as an object, the characteristics of the element update animation can be set. Here's an example configuration:

```json
{
  "animationUpdate": {
    "duration": 500
  }
}
```

### Exit Element Animation

The exit element animation refers to the animation effect of the element corresponding to the deleted data when the chart data is updated. We can use the `animationExit` configuration to set the exit element animation.

`animationExit` can be either a boolean value or an object. When set to `false`, it will disable the exit element animation. When set as an object, the characteristics of the exit element animation can be set. Here's an example configuration:

```json
{
  "animationExit": {
    "duration": 500
  }
}
```

## Chart Exit Animation

In some scenarios, we may need to remove the chart. At that time, we can set the exit animation for the chart so that there is a smooth transition animation effect before the chart is removed. We can use the `animationDisappear` configuration to set the chart exit animation.

`animationDisappear` can be either a boolean value or an object. When set to `false`, the chart exit animation will be turned off. When set as an object, the characteristics of the chart exit animation can be set. Here's an example configuration:

```json
{
  "animationDisappear": {
    "duration": 1000
  }
}
```

## Normal Animation

When chart elements are not in the aforementioned animation states, they enter the normal state (`animationNormal`). In this state, you can perform some carousel animations or create unique non-looping entrance/new element effects.

## Global Morphing Animation

VChart provides morphing animations for related series switches. When you update the chart configuration through `updateSpec`, VChart checks whether the two related series of the new and old charts meet the conditions for morphing animation and then performs one-to-one, one-to-many, or many-to-one dynamic transitions between shapes.
Global morphing animations allow users to have a better visual experience when the displayed chart type changes, avoiding the feeling of sudden changes, as visual comfort should be an important factor we should consider in the process of displaying and analyzing data.

### One-to-One Animation

A one-to-one animation is the transition animation between two different shapes. For example, in the following example, the global animation when switching between the pie chart and the bar chart is shown:

```javascript livedemo
/**
 * Since version 1.12.0, global morph animations need to be manually registered to take effect.
 *
 * import { registerMorph } from '@visactor/vchart';
 *
 * registerMorph();
 *
 * Since version 2.0.0, global morph animations are enabled by default, and manual registration is no longer needed.
 */

VCHART_MODULE.registerMorph && VCHART_MODULE.registerMorph();

const pieSpec = {
  type: 'pie',
  data: [
    {
      values: [
        { type: '1', value: Math.random() },
        { type: '2', value: Math.random() },
        { type: '3', value: Math.random() }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.6,
  valueField: 'value',
  categoryField: 'type',
  tooltip: false
};

const barSpec = Object.assign({}, pieSpec, {
  type: 'bar',
  xField: 'type',
  yField: 'value',
  seriesField: 'type'
});

const specs = [pieSpec, barSpec];

const vchart = new VChart(specs[0], { dom: CONTAINER_ID });

vchart.renderSync();
let count = 1;
setInterval(() => {
  vchart.updateSpec(specs[count % 2]);
  count++;
}, 2000);
```

### One-to-Many Animation

A one-to-many animation is the transition animation from one graphical element to multiple graphical elements. For example, in the following example, the global animation when switching between the bar chart and the scatter plot is shown. The animation where a large bar is split into multiple scatter points is a one-to-many animation.

```javascript livedemo
/**
 * Since version 1.12.0, global morph animations need to be manually registered to take effect.
 *
 * import { registerMorph } from '@visactor/vchart';
 *
 * registerMorph();
 *
 * Since version 2.0.0, global morph animations are enabled by default, and manual registration is no longer needed.
 */

VCHART_MODULE.registerMorph && VCHART_MODULE.registerMorph();
function calculateAverage(data, dim) {
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total += data[i][dim];
  }
  return (total /= data.length);
}

function generateData(type) {
  const data = [];
  for (let i = 0; i < 10; i++) {
    data.push({ x: i, y: Math.random(), type });
  }
  return data;
}
const DataA = generateData('A');

const DataB = generateData('B');

const barSpec = {
  type: 'common',
  series: [
    {
      type: 'bar',
      data: { values: [{ value: calculateAverage(DataA, 'y'), type: 'A' }] },
      xField: 'type',
      yField: 'value',
      morph: {
        morphKey: 'A'
      }
    },
    {
      type: 'bar',
      data: { values: [{ value: calculateAverage(DataB, 'y'), type: 'B' }] },
      xField: 'type',
      yField: 'value',
      morph: {
        morphKey: 'B'
      }
    }
  ],
  axes: [
    { orient: 'left', type: 'linear', max: 1 },
    { orient: 'bottom', type: 'band' }
  ]
};

const scatterSpec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      data: { values: DataA },
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      morph: {
        morphKey: 'A',
        morphElementKey: 'type'
      }
    },
    {
      type: 'scatter',
      data: { values: DataB },
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      morph: {
        morphKey: 'B',
        morphElementKey: 'type'
      }
    }
  ],
  axes: [
    { orient: 'left', type: 'linear', zero: false, max: 1 },
    { orient: 'bottom', type: 'band' }
  ]
};

const specs = [barSpec, scatterSpec];

const vchart = new VChart(specs[0], { dom: CONTAINER_ID });

vchart.renderSync();
let count = 1;
setInterval(() => {
  vchart.updateSpec(specs[count % 2]);
  count++;
}, 3000);
```

### Many-to-One Animation

A many-to-one animation is the transition from multiple graphical elements to one element. For example, in the above example, we can merge multiple points of the scatter plot series into a large bar.

Similar global morphing animations can be achieved in various series switches:
![Global Morphing Animation](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/23e5d313c2c3a66d4ca806001.gif)

## Turn Off Animation

If you want to turn off the animation, you can directly configure `spec.animation: false`, or set it when creating a chart instance:

```js
const vchart = new VChart(specs[0], { dom: CONTAINER_ID, animation: false });
```

That's all for the animation types in VChart. By configuring entrance, update, and exit animations, you can make your charts more vivid and easier to understand. We hope this tutorial has been helpful! Have fun using VChart!
