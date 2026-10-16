---
category: examples
group: storytelling
title: 动态散点图
keywords: scatterChart,scatter,animation,player
order: 36-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/timeline-scatter.gif
option: scatterChart
---

# 动态散点图

## 关键配置

- `player` 属性配置播放器数据和逻辑
  - `player.specs` 属性配置了所有播放时间线上的数据 spec
- `xField` 属性声明为数值字段
- `yField` 属性声明为分类字段
- `sizeField` 属性声明为尺寸字段
- `size` 属性声明尺寸的视觉通道映射
  - `size.type` 配置尺寸的视觉通道映射类型为`linear`连续映射
  - `size.range` 配置数据范围 `[min, max]` 映射到尺寸大小为 `[0,30]`；
- 通过 `dataKey` 指定数据中的 `index` 字段为数据 key，用于数据更新的匹配
- 通过 `markArea` 配置四个象限的颜色；

## 代码演示

```javascript livedemo
const yearData = {};
const firstYear = 1950;
const lastYear = 2023;

for (let year = firstYear; year <= lastYear; year++) {
  const data = [];
  yearData[year] = data;

  for (let i = 0; i < 50; i++) {
    if (year === firstYear) {
      data.push({
        x: Math.round(Math.random() * 100 - 90),
        y: Math.round(Math.random() * 100 - 90),
        value: Math.round(Math.random() * 1000),
        index: i
      });
    } else {
      const previous = yearData[year - 1][i];
      data.push({
        x: previous.x + Math.round(Math.random() * 5 - 2 + i / 50),
        y: previous.y + Math.round(Math.random() * 5 - 2 + i / 50),
        value: Math.abs(previous.value + Math.round(Math.random() * 100 - 45)),
        index: i
      });
    }
  }
}

const specs = Object.values(yearData).map((data, index) => {
  return {
    data: [
      {
        id: 'id',
        values: data
      },
      {
        id: 'year',
        values: [{ year: Object.keys(yearData)[index] }]
      }
    ]
  };
});

const DURATION = 300;

// 配置项
const spec = {
  type: 'common',
  player: {
    orient: 'bottom',
    auto: true,
    interval: DURATION,
    dy: 10,
    specs
  },
  data: specs[0].data,
  axes: [
    {
      orient: 'left',
      nice: true,
      zero: false,
      type: 'linear',
      range: { min: -100, max: 100 },
      tick: {
        tickCount: 10
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'bottom',
      nice: true,
      label: { visible: true },
      type: 'linear',
      range: { min: -100, max: 100 },
      tick: {
        tickCount: 10
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  series: [
    {
      type: 'scatter',
      // 通过数据中的 index 进行数据匹配
      dataKey: 'index',
      // 声明点半径大小
      sizeField: 'value',
      size: {
        type: 'linear',
        range: [5, 30]
      },
      xField: 'x',
      yField: 'y',
      point: {
        style: {
          fill: '#000000',
          fillOpacity: 0.6
        }
      },
      animationAppear: {
        duration: DURATION,
        easing: 'linear'
      },
      animationUpdate: {
        duration: DURATION,
        easing: 'linear'
      }
    }
  ],
  customMark: [
    {
      type: 'text',
      dataIndex: 1,
      style: {
        text: datum => datum.year,
        x: () => 50,
        y: () => 10,
        textBaseline: 'top',
        textAlign: 'left',
        fontSize: 100,
        fontWeight: 'bolder',
        fill: 'black',
        fillOpacity: 0.2
      }
    }
  ],
  // FIXME: markArea 性能有问题
  markArea: [
    {
      coordinates: [
        {
          x: -100,
          y: 0
        },
        {
          x: -100,
          y: 100
        },
        {
          x: 0,
          y: 100
        },
        {
          x: 0,
          y: 0
        }
      ],
      area: {
        style: {
          fill: '#E69151',
          fillOpacity: 0.5
        }
      }
    },
    {
      coordinates: [
        {
          x: 0,
          y: 100
        },
        {
          x: 0,
          y: 0
        },
        {
          x: 100,
          y: 0
        },
        {
          x: 100,
          y: 100
        }
      ],
      area: {
        style: {
          fill: '#EACC4E',
          fillOpacity: 0.5
        }
      }
    },
    {
      coordinates: [
        {
          x: -100,
          y: -100
        },
        {
          x: -100,
          y: 0
        },
        {
          x: 0,
          y: 0
        },
        {
          x: 0,
          y: -100
        }
      ],
      area: {
        style: {
          fill: '#9DD5DD',
          fillOpacity: 0.5
        }
      }
    },
    {
      coordinates: [
        {
          x: 0,
          y: 0
        },
        {
          x: 0,
          y: -100
        },
        {
          x: 100,
          y: -100
        },
        {
          x: 100,
          y: 0
        }
      ],
      area: {
        style: {
          fill: '#5DB9BF',
          fillOpacity: 0.5
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
