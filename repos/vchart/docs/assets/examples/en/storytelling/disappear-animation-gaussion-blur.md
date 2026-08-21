---
category: examples
group: storytelling
title: Disappear Animation Gaussian Blur
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/disappear-animation-gaussian-blur-2.0.11.gif
option: lineChart#animationAppear
---

# Disappear Animation Gaussian Blur Effect

In custom animation effects, you can implement the Gaussian blur effect by using the `afterStageRender` method.

## Key configuration

- callBack: The custom callback function or animation implementation class for the disappear animation, used to execute user-defined disappear effects.

### Demo source

```javascript livedemo
// import { vglobal } from '@visactor/vchart';
const vglobal = VCHART_MODULE.vglobal;

function applyDownsampleBlur(imageData, radius) {
  const { width, height } = imageData;

  const downsample = Math.max(1, Math.floor(radius / 2));
  const smallWidth = Math.floor(width / downsample);
  const smallHeight = Math.floor(height / downsample);

  const tempCanvas = vglobal.createCanvas({
    width: smallWidth,
    height: smallHeight,
    dpr: 1
  });
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    return imageData;
  }

  const originalCanvas = vglobal.createCanvas({
    width: width,
    height: height,
    dpr: 1
  });
  const originalCtx = originalCanvas.getContext('2d');
  if (!originalCtx) {
    return imageData;
  }

  originalCtx.putImageData(imageData, 0, 0);

  tempCtx.drawImage(originalCanvas, 0, 0, smallWidth, smallHeight);

  tempCtx.filter = `blur(${radius / downsample}px)`;
  tempCtx.drawImage(tempCanvas, 0, 0);
  tempCtx.filter = 'none';

  originalCtx.clearRect(0, 0, width, height);
  originalCtx.drawImage(tempCanvas, 0, 0, width, height);

  return originalCtx.getImageData(0, 0, width, height);
}

function gaussianBlurAnimate(canvas, ratio) {
  const blurRadius = ratio * 8;

  if (blurRadius <= 0) {
    return canvas;
  }

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
  const blurredImageData = applyDownsampleBlur(imageData, blurRadius);
  ctx.putImageData(blurredImageData, 0, 0);

  ctx.fillStyle = `rgba(255, 255, 255, ${ratio.toFixed(2)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    callBack: (stage, canvas, ratio) => gaussianBlurAnimate(canvas, ratio),
    duration: 2000
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderAsync();

setInterval(() => {
  vchart.runDisappearAnimation();
}, 4000);
```
