# VChart 动画教程

在本教程中，我们将详细介绍如何在 VChart 中使用动画功能。

动画是 VChart 中一个非重要的特性，它可以使图表更加生动和易懂。接下来，我们将通过以下几个章节来了解和学 VChart 图表的动画类型及相关配置：

- 入场动画
- 更新动画
- 退场动画

## 入场动画配置

入场画是指图表创建时的动画效果。我们可以使用 `animationAppear` 配置来设置入场动画。

`animationAppear` 的类型可以是一个布尔值或一个对象。当为 `false` 时，将关闭入场动画。当配置为一个对象时，可以设置入场动画的特性。下面是一个示例配置：

```json
{
  "animationAppear": {
    "duration": 1000, // 动画持续时间，单位为毫秒(ms)
    "easing": "ease" // 动画缓动效果
  }
}
```

## 数据更新动画配置

当我们更新图表数据时，图元发生的属性动画则称为更新动画。在 VChart 中，用户手动调用 `updateData` 接口会触发图表数据更新，另外，点击图例时也更新图表数据。更新动画分为三类：新增图元动画、图元更新动画和退场图元动画。
通常情况下，你不需要考虑如何控制这三种更新动画，因为 VChart 会在数据更新时，识别出新数据与上一次数据间的关联，从而正确执行更新动画。

这里有一个饼图数据更新的例子，我们可以随机更新饼图的数据长度和值：

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

### 新增图元动画

新增图元动画是指当图表数据更新时，新添加数据应的图元的动画效果。我们可以使用 `animationEnter` 配置来设置新增图元动画。

`animationEnter` 的数据类型可以是一个布尔值或一个对象。当配置为 `false` 时，可以关闭新增图元动画。当配置为一个对象时，可以设置新增图元动画的特性。下面是一个示例配置：

```json
{
  "animationEnter": {
    "duration": 500, // 动画持续时间，单位为毫秒(ms)
    "easing": "quadIn" // 动画缓动效果
  }
}
```

### 图元更新动画

图元更新动画是指当图表数据更新，原有数据对应的图元的更新动画效果。我们可以使用 `animationUpdate` 配置来设置图元更新动画。

`animationUpdate` 的数据类型可以是一个布尔值或一个对象。当配置为 `false` 时，可以关闭图元更新动画。当配置为一个对象时，可以设置图元更新动画的特性。下面是一个示例配置：

```json
{
  "animationUpdate": {
    "duration": 500
  }
}
```

### 退场图元动画

退图元动画是指当图表数据更新时，被删除数据所对应图元的动画效果。我们可以使用 `animationExit` 配置来设置退场图元动画。

`animationExit` 的数据类型可以是一个布尔值或一个对象。当配置为 `false` 时，可以关闭退场图元动画。当配置为一个对象时，可以设置退场图元动画的特性。下面是一个示例配置：

```json
{
  "animationExit": {
    "duration": 500
  }
}
```

## 图表退场动画

在某些场景下，我们可能需要移除图表。此时，我们可以为图表设置退场动画，让图表在除之前有一个平滑过渡的动画效果。我们可以使用 `animationDisappear` 配置来设置图表退动画。

`animationDisappear` 的数据类型可以是一个布尔值或一个对象。当配置为 `false` 时，可以关闭图表退场动画。当配置为一个对象时，可以图表退场动画的特性。下面是一个例配置：

```json
{
  "animationDisappear": {
    "duration": 1000
  }
}
```

## 常态动画

当图元不在上述几种动画状态时，会进入当前状态（`animationNormal`），此状态下可以进行一些轮播动画，或是用来制作非循环的特殊新增/入场效果。

## 全局形变动画

VChart 提供了各个系列间相关切换的形变动画。在你通过 `updateSpec` 来更新图表配置时，VChart 会检测新旧图表的两个相关联的系列，是否符合形变动画的条件，从而执行一对一、一对多或多对一的图形之间的动态过渡。
全局形变动画能让用户在展示的图表类型发生变化时有更好的视觉体验，避免看上去是瞬间变化的感觉，毕竟，视觉舒适是我们在展示数据和分析数据的过程中所应当关注的一个重要因素。

### 一对一动画

一对一动画是指两个不同的图形之间的过渡动画。例如在下面这个例子中，展示了我们在饼图和柱状图之间切换时的全局动画：

```javascript livedemo
/**
 * 自1.12.0后，全局形变动画需要手动注册才能生效
 *
 * import { registerMorph } from '@visactor/vchart';
 *
 * registerMorph();
 *
 * 自2.0.0开始，全局形变动画默认开启，不再需要手动注册
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

### 一对多动画

一对多动画是指一个图形元素向多个图形元素过渡的动画。例如在下面这个例子中，展示了我们在柱状图和散点图之间切换时的全局动画，其中，将一个大的柱子拆分为多个散点的动画就是一对多动画。

```javascript livedemo
/**
 * 自1.12.0后，全局形变动画需要手动注册才能生效
 *
 * import { registerMorph } from '@visactor/vchart';
 *
 * registerMorph();
 *
 * 自2.0.0开始，全局形变动画默认开启，不再需要手动注册
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

### 多对一动画

多对一动画是指多个图形元素过渡到一个元素。例如，在上面的例子中，我们可以让散点系列的多个点合并为一个大的柱子。

类似的全局形变动画在各个系列切换中都可以实现：
![全局形变动画](./morph.gif)

## 关闭动画

如果想要关闭动画，可以直接配置 `spec.animation: false`，或在创建图表实例时进行配置：

```js
const vchart = new VChart(specs[0], { dom: CONTAINER_ID, animation: false });
```

以上是 VChart 中关于动画类型的全部内容。通过配置入场动画、更新动画和退场动画，可以使图表变得更加生动和易懂。希望本教程对你有所帮助！祝你在使用 VChart 的过程中玩得开心！
