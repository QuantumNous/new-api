---
category: examples
group: pattern
title: dynamic texture for bar
keywords: animation,morphing,bar,barChart,dynamic-texture,comparison
order: 42-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dynamic-texture-bar.gif
option: barChart#dynamicTexture
---

# Dynamic Texture Effects for Bar Charts

Dynamic texture is a special effect that can add dynamic texture effects to the bars of a bar chart, enhancing the visualization.

## Key Configuration
- `textureOptions.dynamicTexture`: A function for the dynamic texture effect that is called after drawing each cell.
- `textureOptions.beforeDynamicTexture`: A function for the dynamic texture effect that is called before drawing each cell.
- `textureOptions.useNewCanvas`: Try enabling this option when performance is poor.
- `texture`: The shape of the dynamic texture, which should be consistent with the symbolType of the symbol graphic, and can accept a custom path.
- `textureSize`: The size of the dynamic texture.
- `texturePadding`: The spacing of the dynamic texture.
- `textureRatio`: The position of the dynamic texture in the current frame, within the range of [0,1].

## Key Configuration

## Code Demonstration

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  percent: true,
  stack: true,
  axes: [{ orient: 'bottom', bandPadding: 0 }],
  bar: {
    style: {
      texture: 'square',
      textureSize: 10,
      texturePadding: 1,
      textureRatio: 0,
      textureColor: 'orange',
      textureOptions: datum => {
        console.log(datum);
        const func =
          datum.Age === 'Under 5 Years'
            ? (ctx, row, column, rowCount, columnCount, ratio, graphic) =>
                VCHART_MODULE.randomOpacity(ctx, row, column, rowCount, columnCount, ratio, graphic, 0.3)
            : datum.Age === '5 to 13 Years'
            ? (ctx, row, column, rowCount, columnCount, ratio, graphic) =>
                VCHART_MODULE.columnLeftToRight(ctx, row, column, rowCount, columnCount, ratio, graphic)
            : (ctx, row, column, rowCount, columnCount, ratio, graphic) =>
                VCHART_MODULE.columnRightToLeft(ctx, row, column, rowCount, columnCount, ratio, graphic);
        return {
          dynamicTexture: (ctx, row, column, rowCount, columnCount, ratio, graphic) => {
            const _r = func(ctx, row, column, rowCount, columnCount, ratio, graphic);
            ctx.globalAlpha = _r;
            const i = row * columnCount + column;
            ctx.fillStyle =
              datum.Age === 'Under 5 Years' ? 'red' : datum.Age === '5 to 13 Years' ? 'blue' : 'green';
            ctx.fill();
          }
        };
      }
    }
  },
  animationAppear: {
    bar: {
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
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## 相关教程

[进度图](link)
