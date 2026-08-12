---
category: examples
group: storytelling
title: 动态条形图
keywords: barChart,animation,player,rank,rectangle
order: 36-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/ranking-bar.gif
option: barChart
---

# 动态条形图

## 关键配置

- `player` 属性配置播放器数据和逻辑
  - `player.specs` 属性配置了所有播放时间线上的数据 spec
- `customMark` 属性配置自定义文字图元
- `animationUpdate` 属性配置图元更新动画（生长动画时长 > 位置交换动画时长）
  - 通过`options.excludeChannels`将`x`和`y`两个位置属性排除在外
  - 通过`channel`方式为`x`和`y`配置更短的动画时长

## 代码演示

```javascript livedemo
const goldenMedals = {
  2000: [
    { country: 'USA', value: 37 },
    { country: 'Russia', value: 32 },
    { country: 'China', value: 28 },
    { country: 'Australia', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 13 },
    { country: 'Italy', value: 13 },
    { country: 'Netherlands', value: 12 },
    { country: 'Cuba', value: 11 },
    { country: 'U.K.', value: 11 }
  ],
  2004: [
    { country: 'USA', value: 36 },
    { country: 'China', value: 32 },
    { country: 'Russia', value: 28 },
    { country: 'Australia', value: 17 },
    { country: 'Japan', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 11 },
    { country: 'Italy', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'U.K.', value: 9 }
  ],
  2008: [
    { country: 'China', value: 48 },
    { country: 'USA', value: 36 },
    { country: 'Russia', value: 24 },
    { country: 'U.K.', value: 19 },
    { country: 'Germany', value: 16 },
    { country: 'Australia', value: 14 },
    { country: 'South Korea', value: 13 },
    { country: 'Japan', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'France', value: 7 }
  ],
  2012: [
    { country: 'USA', value: 46 },
    { country: 'China', value: 39 },
    { country: 'U.K.', value: 29 },
    { country: 'Russia', value: 19 },
    { country: 'South Korea', value: 13 },
    { country: 'Germany', value: 11 },
    { country: 'France', value: 11 },
    { country: 'Australia', value: 8 },
    { country: 'Italy', value: 8 },
    { country: 'Hungary', value: 8 }
  ],
  2016: [
    { country: 'USA', value: 46 },
    { country: 'U.K.', value: 27 },
    { country: 'China', value: 26 },
    { country: 'Russia', value: 19 },
    { country: 'Germany', value: 17 },
    { country: 'Japan', value: 12 },
    { country: 'France', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'Australia', value: 8 }
  ],
  2020: [
    { country: 'USA', value: 39 },
    { country: 'China', value: 38 },
    { country: 'Japan', value: 27 },
    { country: 'U.K.', value: 22 },
    { country: 'Russian Olympic Committee', value: 20 },
    { country: 'Australia', value: 17 },
    { country: 'Netherlands', value: 10 },
    { country: 'France', value: 10 },
    { country: 'Germany', value: 10 },
    { country: 'Italy', value: 10 }
  ]
};

const colors = {
  China: '#d62728',
  USA: '#1664FF',
  Russia: '#B2CFFF',
  'U.K.': '#1AC6FF',
  Australia: '#94EFFF',
  Japan: '#FF8A00',
  Cuba: '#FFCE7A',
  Germany: '#3CC780',
  France: '#B9EDCD',
  Italy: '#7442D4',
  'South Korea': '#DDC5FA',
  'Russian Olympic Committee': '#B2CFFF',
  Netherlands: '#FFC400',
  Hungary: '#FAE878'
};

const dataSpecs = Object.keys(goldenMedals).map(year => {
  return {
    data: [
      {
        id: 'id',
        values: goldenMedals[year]
          .sort((a, b) => b.value - a.value)
          .map(v => {
            return { ...v, fill: colors[v.country] };
          })
      },
      {
        id: 'year',
        values: [{ year }]
      }
    ]
  };
});
const duration = 1000;
const exchangeDuration = 600;

const spec = {
  type: 'bar',
  padding: {
    top: 12,
    right: 100,
    bottom: 12
  },
  data: dataSpecs[0].data,
  direction: 'horizontal',
  yField: 'country',
  xField: 'value',
  seriesField: 'country',
  bar: {
    style: {
      fill: datum => datum.fill
    }
  },
  axes: [
    {
      animation: true,
      orient: 'bottom',
      type: 'linear',
      visible: true,
      max: 50,
      grid: {
        visible: true
      }
    },
    {
      animation: true,
      id: 'axis-left',
      orient: 'left',
      width: 130,
      tick: { visible: false },
      label: { visible: true },
      type: 'band'
    }
  ],
  title: {
    visible: true,
    text: 'Top 10 Olympic Gold Medals by Country Since 2000'
  },
  animationUpdate: {
    bar: [
      {
        type: 'update',
        options: { excludeChannels: ['y'] },
        easing: 'linear',
        duration
      },
      {
        channel: ['y'],
        easing: 'circInOut',
        duration: exchangeDuration
      }
    ],
    axis: {
      duration: exchangeDuration,
      easing: 'circInOut'
    }
  },
  animationEnter: {
    bar: [
      {
        type: 'moveIn',
        duration: exchangeDuration,
        easing: 'circInOut',
        options: {
          direction: 'y',
          orient: 'negative'
        }
      }
    ]
  },
  animationExit: {
    bar: [
      {
        type: 'fadeOut',
        duration: exchangeDuration
      }
    ]
  },
  customMark: [
    {
      type: 'text',
      dataId: 'year',
      style: {
        textBaseline: 'bottom',
        fontSize: 200,
        textAlign: 'right',
        fontFamily: 'PingFang SC',
        fontWeight: 600,
        text: datum => datum.year,
        x: (datum, ctx) => {
          return ctx.vchart.getChart().getCanvasRect()?.width - 50;
        },
        y: (datum, ctx) => {
          return ctx.vchart.getChart().getCanvasRect()?.height - 50;
        },
        fill: 'grey',
        fillOpacity: 0.5
      }
    }
  ],
  player: {
    type: 'continuous',
    orient: 'bottom',
    auto: true,
    loop: true,
    dx: 80,
    position: 'middle',
    interval: duration,
    specs: dataSpecs,
    slider: {
      railStyle: {
        height: 6
      }
    },
    controller: {
      backward: {
        style: {
          size: 12
        }
      },
      forward: {
        style: {
          size: 12
        }
      },
      start: {
        order: 1,
        position: 'end'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
