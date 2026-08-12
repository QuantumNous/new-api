---
title: 68. 图例形状是否可以设置为长方形？</br>
---
## 问题标题

图例形状是否可以设置为长方形？</br>
## 问题描述

图例默认形状是圆形，想修改成长方形，该怎么配置？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Uu8jbXqseoiUdzxvkoQcHhuGn8e.gif' alt='' width='201' height='75'>



## 解决方案 

在图例的item.shape.style中分别配置symbolType: 'rect' 和 size: [width: height]即可。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BK82bht62o9jKFxHrq6c9B99n9u.gif' alt='' width='3252' height='1262'>

## 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: '100% stacked line chart of cosmetic products sales'
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [
    { 
      visible: true, 
      position: 'middle', 
      orient: 'bottom',
      item: {
        shape: {
          style: {
            symbolType: 'rect',
            size: [20, 10]
          }
        }
      }
    }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
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

在线效果参考：https://codesandbox.io/p/sandbox/legend-symbol-type-mwsr2d?file=%2Fsrc%2Findex.ts%3A6%2C12</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WcdSbAU9JorEvAxNfB1ce26Cnjh.gif' alt='' width='1594' height='978'>



## 相关文档

图例教程: https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend</br>
相关api：https://www.visactor.io/vchart/option/barChart-legends-discrete#item.shape.style.symbolType</br>
github：https://github.com/VisActor/VChart</br>



