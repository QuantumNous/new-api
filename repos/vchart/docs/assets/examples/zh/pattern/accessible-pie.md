---
category: examples
group: pattern
title: 带纹理的饼图
keywords: pieChart,comparison,proportion,composition,pattern,label,circle
order: 41-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/pattern/accessible-pie.png
option: pieChart
---

# 带纹理的饼图

通过纹理来填充图表，在一些屏幕亮度比较低或者面向色弱色盲人群的场景下，可以提高图表的可读性。

## 关键配置

在图元上配置纹理相关的属性即可：

- `texture`: 纹理类型配置，支持：`'circle' | 'diamond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid'`。
- `textureColor`: 纹理颜色。
- `textureSize`: 纹理单元的大小。
- `texturePadding`: 纹理单元间的空隙大小。

## 代码演示

```javascript livedemo
const textureMap = {
  NVDA: 'circle',
  JAWS: 'horizontal-line',
  VoiceOver: 'vertical-line',
  ZoomText: 'bias-rl',
  Other: 'grid'
};

const spec = {
  type: 'pie',
  data: {
    id: 'pieData',
    values: [
      {
        name: 'NVDA',
        y: 40.6
      },
      {
        name: 'JAWS',
        y: 40.1
      },
      {
        name: 'VoiceOver',
        y: 12.9
      },
      {
        name: 'ZoomText',
        y: 2
      },
      {
        name: 'Other',
        y: 4.4
      }
    ]
  },
  categoryField: 'name',
  valueField: 'y',
  padAngle: 2, // The angular padding applied to sides of the arc, in degree.
  pie: {
    style: {
      texture: datum => textureMap[datum.name]
    },
    state: {
      hover: {
        centerOffset: 10
      }
    }
  },
  label: {
    visible: true,
    style: {
      text: datum => {
        // return [datum.name, `${datum.y}%`]; // Text wrap
        return `${datum.name}: ${datum.y}%`;
      },
      fontSize: 12
    },
    line: {
      line1MinLength: 30
    }
  },
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window.vchart = vchart;
```

## 相关教程

[散点图](link)
