---
title: 26. 如何控制图表以及图表内组件的布局间距</br>
---
## 问题标题

如何控制图表以及图表内组件的布局间距</br>


## 问题描述

如何控制图表以及图表内组件的布局间距，如下图想要调整红框标记处的间距，让图表坐标轴和图例在左侧能对齐</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Q53VbI3XvoKqVHxSFfwc3em0nHg.gif' alt='' width='804' height='496'>

## 解决方案

可以使用 VChart 上提供的 `padding` 属性，如果想要配置图表的 padding，直接在 spec 的一级配置即可，如下：</br>


```
const spec = {
  padding: {
    left: 0,
  }
}</br>
```


如果想要配置组件的 padding，直接在对应组件的属性下配置即可，VChart 为图表上所有的元素否提供了 padding 属性，具体使用可以在配置页面查找。</br>


## 代码示例  

下面的代码在 axes、legends 以及图表上配置了 padding，让图表左侧留白为 0。</br>
```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          x: '2:00',
          y: 82,
          type: 'sales'
        },
        {
          x: '4:00',
          y: 50,
          type: 'sales'
        },
        {
          x: '6:00',
          y: 64,
          type: 'sales'
        },
        {
          x: '8:00',
          y: 30,
          type: 'sales'
        },
        {
          x: '10:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '12:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '14:00',
          y: 56,
          type: 'sales'
        },
        {
          x: '16:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '18:00',
          y: 64,
          type: 'sales'
        },
        {
          x: '20:00',
          y: 74,
          type: 'sales'
        },
        {
          x: '22:00',
          y: 98,
          type: 'sales'
        },
        {
          x: '2:00',
          y: 62,
          type: 'profit'
        },
        {
          x: '4:00',
          y: 30,
          type: 'profit'
        },
        {
          x: '6:00',
          y: 32,
          type: 'profit'
        },
        {
          x: '8:00',
          y: 10,
          type: 'profit'
        },
        {
          x: '10:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '12:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '14:00',
          y: 36,
          type: 'profit'
        },
        {
          x: '16:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '18:00',
          y: 44,
          type: 'profit'
        },
        {
          x: '20:00',
          y: 74,
          type: 'profit'
        },
        {
          x: '22:00',
          y: 78,
          type: 'profit'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'y',
  yField: ['x', 'type'],
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'bottom',
    position: 'left',
    padding: {
      left: 0
    }
  },
  axes: [
    {
      orient: 'left',
      paddingInner: 0,
      padding: {
        left: 0
      }
    }
  ],
  padding: {
    left: 0
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/G1aIby60LoTsxqxIcibcdGLRnmc.gif' alt='' width='818' height='624'>

## 相关文档

*  API：</br>
*  https://visactor.io/vchart/option/barChart#padding</br>
*  https://visactor.io/vchart/option/barChart-axes-linear#padding</br>
*  https://visactor.io/vchart/option/barChart-legends-discrete#padding</br>
*  Github：https://github.com/VisActor/VChart/</br>



