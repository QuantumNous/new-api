---
category: examples
group: pattern
title: dynamic texture for progress
keywords: animation,morphing,linearProgress,dynamic-texture,comparison
order: 42-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dynamic-texture-lineprogress.gif

option: linearProgress#dynamicTexture
---

# Dynamic Texture Effects for Progress Charts

Dynamic texture is a special effect that adds dynamic texture effects to the progress bar of a progress chart, enhancing the visual experience.
## Key Configurations
- `textureOptions.dynamicTexture`: A function for the dynamic texture effect, called after drawing each cell.
- `textureOptions.beforeDynamicTexture`: A function for the dynamic texture effect, called before drawing each cell.
- `textureOptions.useNewCanvas`: Try enabling this option when performance is poor.
- `texture`: The shape of the dynamic texture, which should match the `symbolType` of the symbol graphic, and can accept a custom path.
- `textureSize`: The size of the dynamic texture.
- `texturePadding`: The spacing of the dynamic texture.
- `textureRatio`: The position of the dynamic texture in the current frame, within the range of [0,1].

## Key Configurations

## Code Demonstration

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
