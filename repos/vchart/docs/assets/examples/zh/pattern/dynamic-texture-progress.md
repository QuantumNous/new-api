---
category: examples
group: pattern
title: 进度图的动态纹理
keywords: animation,morphing,linearProgress,dynamic-texture,comparison
order: 42-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dynamic-texture-lineprogress.gif

option: linearProgress#dynamicTexture
---

# 进度图的动态纹理效果

动态纹理是一种特殊效果，它可以在进度图的进度条上添加动态的纹理效果，从而增强可视化效果。
## 关键配置
- `textureOptions.dynamicTexture`: 动态纹理效果的函数，会在绘制每一个cell之后调用。
- `textureOptions.beforeDynamicTexture`: 动态纹理效果的函数，会在绘制每一个cell之前调用。
- `textureOptions.useNewCanvas`: 当性能不佳时，尝试开启这个选项。
- `texture`: 动态纹理的形状，和symbol图元的symbolType一致，可以传入自定义的path。
- `textureSize`: 动态纹理的大小。
- `texturePadding`: 动态纹理的间距。
- `textureRatio`: 动态纹理当前帧的位置，[0,1]区间。

## 关键配置

## 代码演示

```javascript livedemo
const path =
      'M 8.25 -11 L 11 -11 V -8.25 L -8.25 11 H -11 V 8.25 L 8.25 -11 Z M -11 -11 H -8.3789 L -11 -8.2539 V -11 Z M 11 11 H 8.3789 L 11 8.2539 V 11 Z';
const spec = {
  background: 'black',
  type: 'linearProgress',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Tradition Industries',
          value: 0.795,
          text: '79.5%'
        },
        {
          type: 'Business Companies',
          value: 0.25,
          text: '25%'
        },
        {
          type: 'Customer-facing Companies',
          value: 0.065,
          text: '6.5%'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'type',
  seriesField: 'type',
  track: {
    style: {
      opacity: 0.3
    }
  },
  progress: {
    topPadding: 2,
    bottomPadding: 2,
    style: {
      texture: path,
      textureSize: 30,
      texturePadding: 0,
      textureRatio: 1,
      textureColor: 'orange',
      textureOptions: datum => {
        return {
          // useNewCanvas: true,
          beforeDynamicTexture: (ctx, row, column, rowCount, columnCount, ratio, graphic) => {
            const dx = ratio - 0.5;
            const size = 30;
            ctx.translate(dx * size, 0);
          },
          dynamicTexture: (ctx, row, column, rowCount, columnCount, ratio, graphic) => {
            const dx = ratio - 0.5;
            const size = 30;
            ctx.translate(-dx * size, 0);
            ctx.fillStyle = 'white';
            ctx.globalAlpha = 0.6;
            ctx.fill();
          }
        };
      }
    }
  },
  animationAppear: {
    progress: {
      channel: {
        textureRatio: {
          from: 0,
          to: 1
        }
      },
      easing: 'linear',
      duration: 3000,
      loop: true
    }
  },
  cornerRadius: 20,
  bandWidth: 20,
  axes: [
    {
      orient: 'left',
      label: { visible: false },
      type: 'band',
      domainLine: { visible: false },
      tick: { visible: false }
    },
    { orient: 'bottom', label: { visible: true }, type: 'linear', visible: false }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## 相关教程

[进度图](link)
