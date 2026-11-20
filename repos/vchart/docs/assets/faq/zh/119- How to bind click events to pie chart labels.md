---
title: 67.如何绑定饼图label的点击事件</br>
---
## 问题标题

如何绑定饼图label的点击事件？</br>
## 问题描述

如下饼图中，希望能够在点击的标签的时候，实现自定义的回调，应该怎么实现？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AQh9bZNIcojcdFxsoJ1chubhneb.gif' alt='' width='824' height='502'>

## 解决方案 

VChart中，标签组件默认是不响应事件的，主要为了避免标签比较密集的时候，影响图表中主要图元的事件响应，想要实现标签的事件监听，需要两步：</br>
*  开启标签的事件响应，即`label.interactive`设置为`true`</br>
*  通过 `{ level: 'model', type: 'label' }`实现标签组件的事件监听</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WEzVb5ejIoZnffxnB8Xc6bgrnud.gif' alt='' width='3194' height='1090'>

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
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    interactive: true
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

vchart.on('click',{ level:'model', type:'label'}, (e) => { 
  console.log('label', e) 
})

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 相关文档

*  [事件API](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fapi%2FAPI%2Fevent)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

