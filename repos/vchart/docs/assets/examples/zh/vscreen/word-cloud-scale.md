---
category: examples
group: vscreen
title: 带文字缩放动画的词云图
keywords: wordCloud,text,distribution
cover: /vchart/preview/word-cloud-scale.gif
option: vscreen
---

# 带文字缩放动画的词云图

动画执行过程:

1. 入场动画: 初次渲染时执行

- 文字缩放: 词云图文字依次缩放
- 渐显: 词云图文字透明度由 0 到 1

此案例包含:
入场:文字缩放

## 关键配置

- `animationAppear`: 入场动画, 初次渲染时的动画效果
- `animationNormal`: 常态动画, 初次渲染后, 图表在没有任何状态更新情况下的动画效果, 通常以固定的间隔轮播执行
- `animationUpdate`: 图表更新状态时, 图元在更新时的动画效果
- `animationEnter`: 图表更新状态时, 图元在新增时的动画效果
- `animationExit`: 图表更新状态时, 图元在退场时的动画效果

## 代码演示

```javascript livedemo
const spec = {
  // default size
  // width: 400,
  // height: 225,
  type: 'wordCloud',
  nameField: 'UYeUD4rJfCmv',
  valueField: 'oRp9h3fI9Kcw',
  fontSizeRange: [10, 50],
  fontWeightRange: [400, 400],
  random: false,
  wordCloudConfig: {
    zoomToFit: {
      shrink: true,
      enlarge: true,
      fontSizeLimitMin: 5
    }
  },
  word: {
    padding: 0,
    state: {
      hover: {
        cursor: 'pointer',
        fillOpacity: 0.8,
        stroke: '#58595B',
        lineWidth: 1,
        zIndex: 500
      },
      selected: {
        cursor: 'pointer',
        fillOpacity: 1,
        stroke: '#58595B',
        lineWidth: 1
      },
      selected_reverse: {
        fillOpacity: 0.3,
        lineWidth: 0.3
      }
    },
    style: {
      padding: 20
    }
  },
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  maskShape: 'circle',
  data: [
    {
      id: 'data',
      values: [
        {
          UYeUD4rJfCmv: '河北',
          oRp9h3fI9Kcw: 30
        },
        {
          UYeUD4rJfCmv: '山西',
          oRp9h3fI9Kcw: 20
        },
        {
          UYeUD4rJfCmv: '内蒙古',
          oRp9h3fI9Kcw: 40
        },
        {
          UYeUD4rJfCmv: '辽宁',
          oRp9h3fI9Kcw: 10
        },
        {
          UYeUD4rJfCmv: '吉林',
          oRp9h3fI9Kcw: 50
        },
        {
          UYeUD4rJfCmv: '江西',
          oRp9h3fI9Kcw: 24
        },
        {
          UYeUD4rJfCmv: '山东',
          oRp9h3fI9Kcw: 10
        },
        {
          UYeUD4rJfCmv: '河南',
          oRp9h3fI9Kcw: 20
        },
        {
          UYeUD4rJfCmv: '湖北',
          oRp9h3fI9Kcw: 10
        },
        {
          UYeUD4rJfCmv: '湖南',
          oRp9h3fI9Kcw: 30
        }
      ],
      fields: {
        UYeUD4rJfCmv: {
          alias: 'From Province'
        },
        oRp9h3fI9Kcw: {
          alias: 'Sales'
        }
      }
    }
  ],
  seriesField: 'UYeUD4rJfCmv',
  color: {
    field: 'UYeUD4rJfCmv',
    type: 'ordinal',
    range: [
      '#006EFF',
      '#00E5E5',
      '#2E55EA',
      '#B8E7FE',
      '#00D689',
      '#B7F9F5',
      '#FBCC71',
      '#F46E50',
      '#006EFF',
      '#00E5E5'
    ],
    specified: {}
  },
  hover: {
    enable: true
  },
  select: {
    enable: true
  },
  tooltip: {
    visible: true,
    renderMode: 'canvas',
    mark: {
      visible: true,
      updateTitle: (prev, datum) => {
        prev.value = datum[0].datum[0][spec.nameField];
        return prev;
      },
      updateContent: (prev, datum) => {
        prev.forEach(p => {
          p.shapeType = 'rect';
          p.value = datum[0].datum[0][spec.valueField] + '.00';
          console.log('datum', datum);
        });
      }
    },
    style: {
      panel: {
        padding: {
          top: 5,
          bottom: 10,
          left: 10,
          right: 10
        },
        backgroundColor: 'rgba(8, 28, 48, 0.95)',
        border: {
          color: '#CFCFCF',
          width: 0,
          radius: 2
        },
        shadow: {
          x: 0,
          y: 4,
          blur: 12,
          spread: 0,
          color: 'rgba(0, 0, 0, 0.2)'
        }
      },
      titleLabel: {
        fontSize: 14,
        fontColor: '#FFF',
        fontWeight: 'bold',
        fontFamily: 'D-DIN',
        align: 'left',
        lineHeight: 18
      },
      keyLabel: {
        fontSize: 12,
        fontColor: 'rgba(255,255,255,0.65)',
        fontWeight: 'normal',
        fontFamily: 'SourceHanSansCN-Normal',
        align: 'left',
        lineHeight: 18
      },
      valueLabel: {
        fontSize: 12,
        fontColor: '#FFF',
        fontWeight: 'normal',
        fontFamily: 'D-DIN',
        align: 'right',
        lineHeight: 18
      },
      shape: {
        size: 10,
        spacing: 10
      },
      spaceRow: 10
    },
    dimension: {
      visible: true
    }
  },
  region: [
    {
      clip: true
    }
  ],
  background: 'rgba(0, 0, 0, 1)',
  animation: true,
  animationAppear: {
    preset: 'scaleIn',
    oneByOne: true,
    duration: 1000
  },
  crosshair: {
    xField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    },
    yField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    }
  },
  morph: {
    enable: false
  },
  rotateAngles: [0],
  plotLayout: {
    clip: false
  },
  hash: 'ed60100d47ef24716b23000a8fb944a4'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
