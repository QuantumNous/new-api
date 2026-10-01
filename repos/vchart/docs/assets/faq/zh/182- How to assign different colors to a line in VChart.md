---
title: 46. VChart 怎么给一根线配置不同的颜色</br>
---
## 问题标题

如何给一根线配置不同的颜色</br>
## 问题描述

线有一部分是预测数据，希望预测数据时虚线并且颜色不一样</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QSjQbbuEOoB8vLxoa9ycE15Nnth.gif' alt='' width='741' height='528'>



## 解决方案 

VChart 的线可以通过函数给一根线上的不同数据返回不同的样式。当出现样式不一致的情况，我们会在绘图时，将上一个数据到当前数据的线段绘制为当前数据对应的样式</br>


## 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        x: '1st',
        y: 0.012
      },
      {
        x: '2nd',
        y: -0.01
      },
      {
        x: '3rd',
        y: 0.005
      },
      {
        x: '4th',
        y: 0.007
      },
      {
        x: '5th',
        y: 0.01
      },
      {
        x: '6th',
        y: 0.017
      },
      {
        x: '7th',
        y: 0.022
      },
      {
        x: '8th (prediction)',
        y: 0.033,
        latest: true
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  line: {
    style: {
      lineDash: data => {
        if (data.latest) {
          return [5, 5];
        }
        return [0];
      },
      stroke: data => {
        if (data.latest) {
          return 'green';
        }
        return 'blue';
      }
    }
  },
  point: {
    style: {
      fill: data => {
        if (data.latest) {
          return 'green';
        }
        return 'blue';
      }
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UE3Ab0FIfoYghsxbUlZcCs5Nnxc.gif' alt='' width='1299' height='566'>

Demo: https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-mxqfr3?file=%2Fsrc%2Findex.js%3A59%2C13</br>
## 相关文档

Demo：https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-mxqfr3?file=%2Fsrc%2Findex.js%3A59%2C13</br>
教程：</br>
*  初始化VChart： https://visactor.io/vchart/api/API/vchart</br>
*  线的样式配置：https://www.visactor.io/vchart/option/lineChart#line.style.stroke</br>
Github：https://github.com/VisActor/VChart/</br>



