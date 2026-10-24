---
category: examples
group: customMark
title: Custom Mark
order: 40-0
keywords: customMark
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/57a706137957fce7388f3ab00.png
option: barChart#customMark
---

# Custom Mark

## Key option

- `player` attribute configures player data and logic
  - `player.specs` attribute configures all data specs on the playback timeline
- `customMark` attribute configures custom text graphics
- `animationUpdate` attribute configures the graphic update animation (growth animation duration > position swap animation duration)
  - Exclude `x` and `y` position attributes through `options.excludeChannels`
  - A shorter animation duration is configured for `x` and `y` via the `channel` method

## Demo source

```javascript livedemo
const goldenMedals = {
  2000: [
    { country: '美国', value: 37 },
    { country: '俄罗斯', value: 32 },
    { country: '中国', value: 28 },
    { country: '澳大利亚', value: 16 },
    { country: '德国', value: 13 },
    { country: '法国', value: 13 },
    { country: '意大利', value: 13 },
    { country: '荷兰', value: 12 },
    { country: '古巴', value: 11 },
    { country: '英国', value: 11 }
  ],
  2004: [
    { country: '美国', value: 36 },
    { country: '中国', value: 32 },
    { country: '俄罗斯', value: 28 },
    { country: '澳大利亚', value: 17 },
    { country: '日本', value: 16 },
    { country: '德国', value: 13 },
    { country: '法国', value: 11 },
    { country: '意大利', value: 10 },
    { country: '韩国', value: 9 },
    { country: '英国', value: 9 }
  ],
  2008: [
    { country: '中国', value: 48 },
    { country: '美国', value: 36 },
    { country: '俄罗斯', value: 24 },
    { country: '英国', value: 19 },
    { country: '德国', value: 16 },
    { country: '澳大利亚', value: 14 },
    { country: '韩国', value: 13 },
    { country: '日本', value: 9 },
    { country: '意大利', value: 8 },
    { country: '法国', value: 7 }
  ],
  2012: [
    { country: '美国', value: 46 },
    { country: '中国', value: 39 },
    { country: '英国', value: 29 },
    { country: '俄罗斯', value: 19 },
    { country: '韩国', value: 13 },
    { country: '德国', value: 11 },
    { country: '法国', value: 11 },
    { country: '澳大利亚', value: 8 },
    { country: '意大利', value: 8 },
    { country: '匈牙利', value: 8 }
  ],
  2016: [
    { country: '美国', value: 46 },
    { country: '英国', value: 27 },
    { country: '中国', value: 26 },
    { country: '俄罗斯', value: 19 },
    { country: '德国', value: 17 },
    { country: '日本', value: 12 },
    { country: '法国', value: 10 },
    { country: '韩国', value: 9 },
    { country: '意大利', value: 8 },
    { country: '澳大利亚', value: 8 }
  ],
  2020: [
    { country: '美国', value: 39 },
    { country: '中国', value: 38 },
    { country: '日本', value: 27 },
    { country: '英国', value: 22 },
    { country: '俄罗斯奥林匹克委员会', value: 20 },
    { country: '澳大利亚', value: 17 },
    { country: '荷兰', value: 10 },
    { country: '法国', value: 10 },
    { country: '德国', value: 10 },
    { country: '意大利', value: 10 }
  ]
};

const dataSpecs = Object.keys(goldenMedals).map(year => {
  return {
    data: [
      {
        id: 'id',
        values: goldenMedals[year].sort((a, b) => b.value - a.value)
      },
      {
        id: 'year',
        values: [{ year }]
      }
    ]
  };
});
const duration = 2000;
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
  axes: [
    {
      animation: true,
      orient: 'bottom',
      type: 'linear',
      visible: true,
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
    text: 'Top 10 Olympic Gold Medals by Country Since 2000',
    padding: {
      left: 50,
      bottom: 10
    }
  },
  animationUpdate: {
    bar: [
      {
        type: 'update',
        options: { excludeChannels: ['x', 'y'] },
        duration
      },
      {
        channel: ['x', 'y'],
        options: { excludeChannels: ['width'] },
        duration: 500
      }
    ],
    axis: {
      duration: 500,
      easing: 'linear'
    }
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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Custom Mark](link)
