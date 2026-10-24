---
category: examples
group: pattern
title: 柱状图的动态纹理
keywords: animation,morphing,bar,barChart,dynamic-texture,comparison
order: 42-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dynamic-texture-bar.gif
option: barChart#dynamicTexture
---

# 柱状图的动态纹理效果

动态纹理是一种特殊效果，它可以在柱状图的柱子上添加动态的纹理效果，从而增强可视化效果。
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
