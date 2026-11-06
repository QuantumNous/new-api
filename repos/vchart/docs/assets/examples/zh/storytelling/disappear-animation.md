---
category: examples
group: storytelling
title: Disappear Animation
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/disappear-animation-2.0.11.gif
option: lineChart#animationAppear
---

# 退场动画

用户可以手动调用 `vchart.runDisappearAnimation()` 方法执行退场动画。
退场动画与入场、更新等其他动画配置的差异之处在于退场动画额外提供了 `callBack` 参数用于执行用户的自定义退场效果。
用户可以在 `callBack` 参数中配置动画的自定义插值回调函数，或者提供一个继承自 `AStageAnimation` 的动画实现类。

## 关键配置

- callBack: 退场动画的自定义回调函数/动画实现类，用于执行用户自定义的退场效果。

### 代码演示

```javascript livedemo
// import { vglobal } from '@visactor/vchart';
// import { AStageAnimate } from '@visactor/vrender-animate';
const vglobal = VCHART_MODULE.vglobal;
const AStageAnimate = VRender.AStageAnimate;

// 自定义退场动画实现类
class TestStageAnimate extends AStageAnimate {
  onUpdate(end, ratio, out) {
    super.onUpdate(end, ratio, out);
    this.ratio = ratio;
  }

  // 更新画布渲染内容
  afterStageRender(stage, canvas) {
    const c = vglobal.createCanvas({
      width: canvas.width,
      height: canvas.height,
      dpr: vglobal.devicePixelRatio
    });
    const ctx = c.getContext('2d');
    if (!ctx) {
      return false;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.ratio.toFixed(2)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return c;
  }
}

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
  animationDisappear: {
    // 自定义动画执行回调函数
    callBack: (stage, canvas, ratio) => {
      const c = vglobal.createCanvas({
        width: canvas.width,
        height: canvas.height,
        dpr: vglobal.devicePixelRatio
      });
      const ctx = c.getContext('2d');
      if (!ctx) {
        return false;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(canvas, 0, 0);
      ctx.fillStyle = `rgba(255, 255, 255, ${ratio.toFixed(2)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return c;
    },
    // 自定义动画执行类使用方式
    // callBack: TestStageAnimate,
    duration: 1000
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderAsync();

setInterval(() => {
  vchart.runDisappearAnimation();
}, 2000);
```
