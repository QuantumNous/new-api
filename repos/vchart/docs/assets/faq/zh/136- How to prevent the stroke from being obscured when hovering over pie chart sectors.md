---
title: 87. 如何避免饼图扇区的hover时描边被遮挡？</br>
---
## 问题标题

VChart  如何避免饼图扇区的hover时描边被遮挡?</br>


## 问题描述

配置了饼图扇区的hover描边，但是会被其他扇区遮挡</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JGQubRzSPorZD0xqVyzc1jrCnNe.gif' alt='' width='471' height='384'>

## 解决方案



可以调整元素在hover时的层级，这样hover元素始终展示在其他扇区上面，就可以避免描边被遮挡的问题</br>
```
 pie: {
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 4,
        zIndex: 1
      }
    }
  },</br>
```
## 代码示例 

```
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true
  },
  pie: {
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 4,
        zIndex: 1
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/StbLbUAg4otZcRxy3TacH0aRnld.gif' alt='' width='694' height='436'>

## 相关文档

*  github：https://www.visactor.io/vchart/option/pieChart#pie.style.zIndex</br>
*  相关 demo：https://www.visactor.io/vchart/demo/pie-chart/basic-pie</br>



