---
title: 13. 如何自定义雷达图富文本轴标签样式？</br>
---
## 问题标题

VChart 能否支持类似富文本样式的轴标签样式？</br>
## 问题描述

期望在标签中支持自定义 icon 和不同的文本样式，类似于：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Kz17bMijnoGa7ExryWlcHTDin1d.gif' alt='' width='630' height='590'>

## 解决方案 

首先，分析一下需求，图中是极坐标系下**角度轴**的标签。</br>
1. **添加轴配置**</br>
在 VChart 中可以通过 `axes` 属性来配置轴，`axes` 接收一个数组，添加一项，将 `axes[0].type: 'angle'` 设置轴类型为角度轴；</br>
1. **配置轴标签**</br>
通过格式化函数 `formatMethod` 配置 `axes[0].label` 为富文本。</br>
`formatMethod` 返回一个富文本内容的配置对象</br>
1. `type: 'rich'`：定义返回文本类型为富文本</br>
1. `text`: 富文本的详细配置。支持文字和图片两种类型，详细配置可以参考[配置项文档](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart%23title.textStyle.character)。</br>
```
formatMethod: (value, data, c, d) => {
  return {
    type: "rich",
    text: [
      {
        image:
          '<svg t="1714116158819" class="icon" viewBox="0 0 1228 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="19433" width="200" height="200"><path d="M1152 76.8v870.4h-1075.2v-870.4h1075.2M1228.8 0H0v1024h1228.8V0z" fill="#0686E5" p-id="19434"></path><path d="M0 0h1228.8v1024H0z" fill="#0686E5" p-id="19435"></path></svg>',
        width: 2,
        height: 10,
      },
      {
        text: ` ${value} `,
        fontSize: 16,
        fill: "black",
        fontWeight: "bold",
      },
      {
        text: ` ${values.find((v) => v.key === value)?.value} `,
        fontSize: 16,
        fill: "rgb(22,100,255)",
        fontWeight: "bold",
      },
    ],
  };
},</br>
```


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BRPUbkayLoUGCWxLXpacSFEbnsg.gif' alt='' width='1470' height='1044'>



## 代码示例  

```
const values = [
        {
          key: 'Strength',
          value: 5
        },
        {
          key: 'Speed',
          value: 5
        },
        {
          key: 'Shooting',
          value: 3
        },
        {
          key: 'Endurance',
          value: 5
        },
        {
          key: 'Precision',
          value: 5
        },
        {
          key: 'Growth',
          value: 5
        }
      ];

const spec = {
  type: 'radar',
  data: [
    {
      id: 'radarData',
      values
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  point: {
    visible: false // disable point
  },
  area: {
    visible: true, // display area
    state: {
      // The style in the hover state of the area
      hover: {
        fillOpacity: 0.5
      }
    }
  },
  line: {
    style: {
      lineWidth: 4
    }
  },
  axes: [
    {
      orient: 'radius', // radius axis
      zIndex: 100,
      min: 0,
      max: 8,
      domainLine: {
        visible: false
      },
      label: {
        visible: true,
        space: 0,
        style: {
          textAlign: 'center',
          stroke: '#fff',
          lineWidth: 4
        }
      },
      grid: {
        smooth: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'angle', // angle axis
      zIndex: 50,
      tick: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      label: {
        space: 20,
         formatMethod: (value, data,c,d) => {
          console.log(value,data,c,d)
      return {
        type: 'rich',
        text: [
          {
            image: '<svg t="1714116158819" class="icon" viewBox="0 0 1228 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="19433" width="200" height="200"><path d="M1152 76.8v870.4h-1075.2v-870.4h1075.2M1228.8 0H0v1024h1228.8V0z" fill="#0686E5" p-id="19434"></path><path d="M0 0h1228.8v1024H0z" fill="#0686E5" p-id="19435"></path></svg>',
            width: 2,
            height: 10
          },
          {
            text: ` ${value} `,
            fontSize: 16,
            fill: 'black',
            fontWeight: 'bold'
          },
           {
            text: ` ${values.find(v => v.key === value)?.value} `,
            fontSize: 16,
            fill: 'rgb(22,100,255)',
            fontWeight: 'bold'
          }
        ]
      };
    }
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 相关文档

富文本 demo：https://visactor.io/vchart/demo/label/richtext-label</br>
相关api：https://visactor.io/vchart/option/radarChart-axes-band#label.formatMethod</br>
github：https://github.com/VisActor/VChart</br>



