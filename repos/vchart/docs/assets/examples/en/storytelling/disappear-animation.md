---
category: examples
group: storytelling
title: Disappear Animation
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/disappear-animation-2.0.11.gif
option: lineChart#animationAppear
---

# Disappear Animation

User can manually call `vchart.runDisappearAnimation()` method to execute the disappear animation.
The difference between the disappear animation and other animations is that it provides an additional `callBack` parameter to execute user-defined disappear effects.
User can configure the custom interpolation callback function or provide a custom animation implementation class in the `callBack` parameter.

## Key configuration

- callBack: The custom callback function or animation implementation class for the disappear animation, used to execute user-defined disappear effects.

### Demo source

```javascript livedemo
// import { vglobal } from '@visactor/vchart';
// import { AStageAnimate } from '@visactor/vrender-animate';
const vglobal = VCHART_MODULE.vglobal;
const AStageAnimate = VRender.AStageAnimate;

// custom disappear animation implementation class
class TestStageAnimate extends AStageAnimate {
  onUpdate(end, ratio, out) {
    super.onUpdate(end, ratio, out);
    this.ratio = ratio;
  }

  // update the canvas rendering content
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
    // custom disappear animation callback function
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
    // custom disappear animation class usage
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
