# 动画的属性与配置

在使用 VChart 创建图表时，我们常希望为基本图形元素添加动画效果，增强用户体验和吸引力。VChart 提供了丰富的动画配置选项，包括动画时长、延迟时长、缓动效果和轮流执行等。本教程将深入介绍这些动画属性的应用方法与配置实例。

## 动画配置

### 动画时长

在 VChart 中，动画时长是指图表动画从开始到结束所需要的时间，单位为毫秒。我们可以使用`animationAppear.duration`属性为图表的入场动画设置时长，默认值为 1000（1 秒）。例如，我们想要设置一个柱状图的动画时长为 1.5 秒，代码如下：

```json
{
  "animationAppear": {
    "duration": 1500
  }
}
```

### 动画延迟开始的时长

有时我们希望图表出现后，再经过段时间才开始播放动画。这时我们可以使用`animationAppear.delay`属性设置动画延迟开始的时长，单位同样为毫秒，默认值为 0。例如，我们希望柱状图在页面加载完成后 2 秒开始播放动画，则可以设置如下：

```json
{
  "animationAppear": {
    "duration": 1500,
    "delay": 2000
  }
  // ...其他图表配置信息
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

### 动画缓动效果

缓动效果是描述动画“变速度”的过程。设置合适的缓动效果可以让图表动画更具生动感。VChart 内置了众多缓动效果类型，我们可以通过`animation.easing`属性来选择。默认值为`cubicOut`。以下可选的内置缓动效果类型，可以参考[缓动 demo](../../../demo/combination/easing-visualization)

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
- elasticOut- elasticInOut

例如，希望柱状图的动画采用`bounceOut`缓动效果：

```json
{
  "animationAppear": {
    "easing": "bounceOut"
  }
  // ...其他图表配置信息
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

### 依次执行

在多个图形元素组成的图表中，我们有时希望这些元素依次执行动画，而不是同时进行。我们可以使用`animationAppear.oneByOne`属性设置此功能。默认值为`false`，表示所有图形元素同时开始动画。将其设置为`true`，则图形元素会轮流播放动画。若设置为数字，则会为每个依次执行的图元之间添加一个对应的延迟时长。例如，为柱状图的中每个柱子设置依次执行的动画效果：

```json
{
  "animationAppear": {
    "easing": "bounceOut",
    "oneByOne": 30
  }
  // ...其他图表配置信息
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

如果想要关闭动画，可以直接配置 `spec.animation: false`，或在创建图表实例时进行配置：

```js
const vchart = new VChart(specs[0], { dom: CONTAINER_ID, animation: false });
```

我们已经掌握了如何在 VChart 中为图表设置动时长、延迟时长、缓动效果和依次执行等属性。在实际应用中，我们可以根据具体需求灵活组合这些属性，为用户呈现更优雅、生动的图表动画效果。
