---
category: examples
group: marker
title: markArea 标签
keywords: marker, scatterChart
order: 33-10
cover: /vchart/preview/mark-area-with-label.png
option: scatterChart#markArea
---

## 关键配置

- 使用 `markArea.label` 属性声明标注标签

## 代码演示

```javascript livedemo
const spec = {
  type: 'scatter',
  xField: 'x',
  yField: 'y',
  sizeField: 'y',
  seriesField: 'name',
  size: {
    type: 'linear',
    range: [10, 80]
  },
  label: {
    visible: true,
    formatMethod: (...p) => {
      return p[1].name;
    },
    style: {
      fill: '#222'
    }
  },
  point: {
    style: {
      fillOpacity: 0.5,
      lineWidth: 1,
      stroke: (...p) => {
        return p[1].seriesColor(p[0].name);
      }
    }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      range: {
        min: 0,
        max: 0.1
      },
      grid: {
        visible: false
      },
      label: {
        visible: false
      },
      title: {
        visible: true,
        text: '← 利润 →'
      }
    },
    {
      orient: 'left',
      type: 'linear',
      range: {
        min: 0,
        max: 10000
      },
      grid: {
        visible: false
      },
      label: {
        visible: false
      },
      title: {
        visible: true,
        text: '← 销量 →'
      }
    }
  ],
  markArea: [
    {
      coordinates: [
        {
          x: 0,
          y: 0
        },
        {
          x: 0.05,
          y: 0
        },
        {
          x: 0.05,
          y: 5000
        },
        {
          x: 0,
          y: 5000
        }
      ],
      area: {
        style: {
          fill: '#ccc',
          fillOpacity: 0
        }
      },
      label: {
        text: '衰退产品',
        position: 'insideRight'
      }
    },
    {
      coordinates: [
        {
          x: 0.05,
          y: 0
        },
        {
          x: 1,
          y: 0
        },
        {
          x: 1,
          y: 5000
        },
        {
          x: 0.05,
          y: 5000
        }
      ],
      area: {
        style: {
          fill: '#ccc',
          fillOpacity: 0.15
        }
      },
      label: {
        text: '厚利产品',
        position: 'insideLeft'
      }
    },
    {
      coordinates: [
        {
          x: 1,
          y: 5000
        },
        {
          x: 1,
          y: 10000
        },
        {
          x: 0.05,
          y: 10000
        },
        {
          x: 0.05,
          y: 5000
        }
      ],
      area: {
        style: {
          fill: '#5B8FF9',
          fillOpacity: 0
        }
      },
      label: {
        text: ' 明星产品',
        position: 'insideLeft'
      }
    },
    {
      coordinates: [
        {
          x: 0,
          y: 5000
        },
        {
          x: 0.05,
          y: 5000
        },
        {
          x: 0.05,
          y: 10000
        },
        {
          x: 0,
          y: 10000
        }
      ],
      area: {
        style: {
          fill: '#ccc',
          fillOpacity: 0.15
        }
      },
      label: {
        text: '问题产品',
        position: 'insideRight'
      }
    }
  ],
  markPoint: [
    {
      coordinate: {
        name: '台灯',
        x: 0.02,
        y: 7000
      },
      itemLine: {
        visible: false
      },
      itemContent: {
        type: 'image',
        autoRotate: false,
        image: {
          style: {
            dy: -6,
            width: 30,
            height: 30,
            image: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/%E7%AE%AD%E5%A4%B4%20%E4%B8%8B%E9%99%8D.png'
          }
        }
      }
    },
    {
      coordinate: {
        name: '耳机线',
        x: 0.08,
        y: 7000
      },
      itemLine: {
        visible: false
      },
      itemContent: {
        type: 'image',
        autoRotate: false,
        image: {
          style: {
            dy: -6,
            dx: 8,
            width: 30,
            height: 30,
            image: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/%E4%B8%8A%E5%8D%87.png'
          }
        }
      }
    }
  ],
  data: {
    id: 'data2',
    values: [
      {
        name: '台灯',
        x: 0.02,
        y: 7000
      },
      {
        name: '充电宝',
        x: 0.06,
        y: 6000
      },
      {
        name: '耳机线',
        x: 0.08,
        y: 7000
      },
      {
        name: '钢化膜',
        x: 0.085,
        y: 5500
      },
      {
        name: '麦克风',
        x: 0.01,
        y: 2000
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[markPoint](link)
