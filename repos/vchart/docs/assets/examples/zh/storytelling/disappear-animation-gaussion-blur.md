---
category: examples
group: storytelling
title: Disappear Animation Gaussian Blur
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/disappear-animation-gaussian-blur-2.0.11.gif
option: lineChart#animationAppear
---

# 退场动画高斯模糊效果

在自定义动画效果中可以通过 `afterStageRender` 方法实现高斯模糊效果。

## 关键配置

- callBack: 退场动画的自定义回调函数/动画实现类，用于执行用户自定义的退场效果。

### 代码演示

```javascript livedemo
// import { vglobal } from '@visactor/vchart';
const vglobal = VCHART_MODULE.vglobal;

function applyDownsampleBlur(imageData, radius) {
  const { width, height } = imageData;

  // 降采样因子，减少计算量
  const downsample = Math.max(1, Math.floor(radius / 2));
  const smallWidth = Math.floor(width / downsample);
  const smallHeight = Math.floor(height / downsample);

  // 创建小尺寸的临时canvas
  const tempCanvas = vglobal.createCanvas({
    width: smallWidth,
    height: smallHeight,
    dpr: 1
  });
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    return imageData;
  }

  // 将图像绘制到小canvas上
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

  // 缩小绘制（自动插值）
  tempCtx.drawImage(originalCanvas, 0, 0, smallWidth, smallHeight);

  // 应用模糊到小图像
  tempCtx.filter = `blur(${radius / downsample}px)`;
  tempCtx.drawImage(tempCanvas, 0, 0);
  tempCtx.filter = 'none';

  // 放大回原尺寸
  originalCtx.clearRect(0, 0, width, height);
  originalCtx.drawImage(tempCanvas, 0, 0, width, height);

  return originalCtx.getImageData(0, 0, width, height);
}

function gaussianBlurAnimate(canvas, ratio) {
  const blurRadius = ratio * 8;

  // 如果模糊强度为0，直接返回原图
  if (blurRadius <= 0) {
    return canvas;
  }

  // 使用传统的像素级模糊
  const c = vglobal.createCanvas({
    width: canvas.width,
    height: canvas.height,
    dpr: vglobal.devicePixelRatio
  });
  const ctx = c.getContext('2d');
  if (!ctx) {
    return false;
  }

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制原始图像
  ctx.drawImage(canvas, 0, 0);

  // 获取图像数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 高质量模式下统一使用降采样模糊
  const blurredImageData = applyDownsampleBlur(imageData, blurRadius);

  // 将模糊后的图像数据绘制到画布上
  ctx.putImageData(blurredImageData, 0, 0);

  // 添加白色遮罩层
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
