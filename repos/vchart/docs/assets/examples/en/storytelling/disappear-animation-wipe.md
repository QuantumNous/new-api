---
category: examples
group: storytelling
title: Disappear Animation Wipe
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/disappear-animation-wipe-2.0.11.gif
option: lineChart#animationAppear
---

# Disappear Animation Wipe Effect

In custom animation effects, you can implement the wipe animation effect by using the `afterStageRender` method.

## Key configuration

- callBack: The custom callback function or animation implementation class for the disappear animation, used to execute user-defined disappear effects.

### Demo source

```javascript livedemo
// import { vglobal } from '@visactor/vchart';
const vglobal = VCHART_MODULE.vglobal;

function wipeAnimate(canvas, ratio) {
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

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const wipePosition = Math.floor(canvas.width * ratio);

  const gradientWidth = Math.min(canvas.width * 0.3, 50);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const originalAlpha = data[index + 3];
      const distance = x - wipePosition;

      let newAlpha;
      if (distance <= 0) {
        newAlpha = 0;
      } else if (distance <= gradientWidth) {
        const gradientRatio = distance / gradientWidth;
        newAlpha = Math.floor(originalAlpha * gradientRatio);
      } else {
        newAlpha = originalAlpha;
      }

      data[index + 3] = newAlpha;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return c;
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
    callBack: (stage, canvas, ratio) => wipeAnimate(canvas, ratio),
    easing: 'linear',
    duration: 2000
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderAsync();

setInterval(() => {
  vchart.runDisappearAnimation();
}, 3000);
```
