---
title: 88. 如何使轴标签带上图形？</br>
---
## 问题标题

VChart  如何使轴标签带上图形？</br>


## 问题描述

想要对x轴的特殊值标签用图形进行标记</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VHdTboml6oZe2axigfDcLpt8nqd.gif' alt='' width='715' height='206'>

## 解决方案

坐标轴的标签目前已经支持配置富文本内容</br>
```
 label: {
        formatMethod: label => {
          return {
            type: 'rich',
            text: [
              {
                text: `${label}`,
                fontSize: 16,
                fontWeight: 'bold',
                fontStyle: 'italic'
              },
              { image: `icon address`, width: 40, height: 40 },
            ]
          };
        }
      }</br>
```
## 代码示例 

```
const rankIcon = {
  'Top 1': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/gold-medal.svg',
  'Top 2': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/silver-medal.svg',
  'Top 3': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/bronze-medal.svg'
};
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { name: 'Top 1', value: 990 },
        { name: 'Top 2', value: 680 },
        { name: 'Top 3', value: 255 }
      ]
    }
  ],
  barWidth: 20,
  yField: 'name',
  xField: 'value',
  bar: {
    style: {
      cornerRadius: [0, 10, 10, 0],
      fill: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          { offset: 0, color: 'rgb(255,163,1)' },
          { offset: 1, color: 'rgb(255,4,0)' }
        ]
      }
    }
  },
  barBackground: {
    visible: true
  },
  label: {
    visible: true,
    position: 'center',
    style: {
      fill: 'white',
      stroke: false
    }
  },
  direction: 'horizontal',
  seriesField: 'type',
  padding: { left: 50 },
  axes: [
    {
      orient: 'left',
      minWidth: 50,
      label: {
        formatMethod: label => {
          return {
            type: 'rich',
            text: [
              { image: rankIcon[label], width: 40, height: 40 },
              {
                text: `${label}`,
                fontSize: 16,
                fontWeight: 'bold',
                fontStyle: 'italic'
              }
            ]
          };
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


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WdJWbe65HoO8xoxpasMcoQTunon.gif' alt='' width='840' height='308'>

## 相关文档

*  github：https://www.visactor.io/vchart/option/barChart-axes-band#label.formatMethod</br>
*  相关 demo：https://www.visactor.io/vchart/demo/axis/axis-richtext-label?keyword=axis</br>



