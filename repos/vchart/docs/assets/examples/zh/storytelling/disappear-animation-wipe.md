---
category: examples
group: storytelling
title: Disappear Animation Wipe
keywords: animation,morphing,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/disappear-animation-wipe-2.0.11.gif
option: lineChart#animationAppear
---

# 退场动画擦除效果

在自定义动画效果中可以通过 `afterStageRender` 方法实现擦除动画效果。

## 关键配置

- callBack: 退场动画的自定义回调函数/动画实现类，用于执行用户自定义的退场效果。

### 代码演示

```javascript livedemo
// import { vglobal } from '@visactor/vchart';
const vglobal = VCHART_MODULE.vglobal;

function wipeAnimate(canvas, ratio) {
  // 创建临时画布
  const c = vglobal.createCanvas({
    width: canvas.width,
    height: canvas.height,
    dpr: vglobal.devicePixelRatio
  });
  const ctx = c.getContext('2d');
  if (!ctx) {
    return false;
  }

  // 将原画布内容绘制到临时画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);

  // 获取临时画布的图像数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 根据ratio计算擦除位置（从左到右）
  const wipePosition = Math.floor(canvas.width * ratio);

  // 设置渐变区域宽度，可根据需要调整
  const gradientWidth = Math.min(canvas.width * 0.3, 50);

  // 遍历每个像素点
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      // 计算当前像素在数据数组中的索引
      const index = (y * canvas.width + x) * 4;

      // 计算当前像素的原始透明度
      const originalAlpha = data[index + 3];

      // 计算当前像素与擦除位置的距离
      const distance = x - wipePosition;

      // 根据距离计算透明度
      let newAlpha;
      if (distance <= 0) {
        // 擦除位置左侧：完全透明
        newAlpha = 0;
      } else if (distance <= gradientWidth) {
        // 渐变区域内：透明度从0到原始透明度渐变
        const gradientRatio = distance / gradientWidth;
        newAlpha = Math.floor(originalAlpha * gradientRatio);
      } else {
        // 擦除位置右侧：保持原始透明度
        newAlpha = originalAlpha;
      }

      // 设置新的透明度
      data[index + 3] = newAlpha;
    }
  }

  // 将处理后的图像数据绘制回临时画布
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
