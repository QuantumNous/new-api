---
title: 61. VChart  如何设置坐标轴宽度？</br>
---
## 问题标题

VChart  如何设置坐标轴宽度？</br>


## 问题描述

图表中坐标轴文字标签比较长，希望能增加一下坐标轴宽度，让文字显示的更多一点，该怎么配置？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UgyUbqSdEoAJB2xZrwPcGptAnlb.gif' alt='' width='900' height='500'>

## 解决方案

你可以配置 axes.width 来设置轴组件的宽度：</br>
1. `width: `50%``：配置百分比字符串，代表布局时组件宽度占图表的一半</br>
```
  axes: [
    {
      orient: 'left',
      width: `50%`
    }
  ],</br>
```
1. `width: 100`：配置固定数值，代表布局时组件宽度的像素宽度</br>
## 代码示例 

```
const spec = {
  type: 'bar',
  width:450,
  height: 250,
  data: [
    {
      id: 'barData',
      values: [
    {
        "name": "Product-Name-:Apple",
        "value": 214480
    },
    {
        "name": "Product-Name-:Google",
        "value": 155506
    },
    {
        "name": "Product-Name-:Amazon",
        "value": 100764
    },
    {
        "name": "Product-Name-:Microsoft",
        "value": 92715
    },
    {
        "name": "Product-Name-:Coca-Cola",
        "value": 66341
    },
    {
        "name": "Product-Name-:Samsung",
        "value": 59890
    },
    {
        "name": "Product-Name-:Toyota",
        "value": 53404
    },
    {
        "name": "Product-Name-:Mercedes-Benz",
        "value": 48601
    },
    {
        "name": "Product-Name-:Facebook",
        "value": 45168
    },
    {
        "name": "Product-Name-:McDonald's",
        "value": 43417
    },
    {
        "name": "Product-Name-:Intel",
        "value": 43293
    },

]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    },
    {
      orient: 'left',
      width: `50%`
    }
  ],
  label: {
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Wa0jbecxxoqEH6xc4OHcha9rnS0.gif' alt='' width='900' height='500'>

## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  轴宽度配置项：https://visactor.io/vchart/option/barChart-axes-linear#width</br>

