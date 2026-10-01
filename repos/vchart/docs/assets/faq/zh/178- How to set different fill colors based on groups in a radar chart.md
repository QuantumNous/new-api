---
title: 31. 雷达图如何根据分组设置不同的填充颜色</br>
---
## 问题标题

雷达图如何根据分组设置不同的填充颜色？</br>


## 问题描述

如图示，雷达图有多个分组，可以给不同分组设置不同的填充颜色吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GBtQbnp8QoUmvdx3chMcVyGnnTc.gif' alt='' width='954' height='936'>

## 解决方案 

VChart 图元样式都支持函数写法，可以通过自定义函数在样式中根据数据返回不同的填充颜色：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DQDObk1vcoi4NHxCzfvcQmqVnAX.gif' alt='' width='3386' height='1232'>





## 代码示例  

```
const spec = {
  type: 'radar',
  data: [
    {
      values: [
        {
          month: 'Jan.',
          value: 45,
          type: 'A'
        },
        {
          month: 'Feb.',
          value: 61,
          type: 'A'
        },
        {
          month: 'Mar.',
          value: 92,
          type: 'A'
        },
        {
          month: 'Apr.',
          value: 57,
          type: 'A'
        },
        {
          month: 'May.',
          value: 46,
          type: 'A'
        },
        {
          month: 'Jun.',
          value: 36,
          type: 'A'
        },
        {
          month: 'Jul.',
          value: 33,
          type: 'A'
        },
        {
          month: 'Aug.',
          value: 63,
          type: 'A'
        },
        {
          month: 'Sep.',
          value: 57,
          type: 'A'
        },
        {
          month: 'Oct.',
          value: 53,
          type: 'A'
        },
        {
          month: 'Nov.',
          value: 69,
          type: 'A'
        },
        {
          month: 'Dec.',
          value: 40,
          type: 'A'
        },
        {
          month: 'Jan.',
          value: 31,
          type: 'B'
        },
        {
          month: 'Feb.',
          value: 39,
          type: 'B'
        },
        {
          month: 'Mar.',
          value: 81,
          type: 'B'
        },
        {
          month: 'Apr.',
          value: 39,
          type: 'B'
        },
        {
          month: 'May.',
          value: 64,
          type: 'B'
        },
        {
          month: 'Jun.',
          value: 21,
          type: 'B'
        },
        {
          month: 'Jul.',
          value: 58,
          type: 'B'
        },
        {
          month: 'Aug.',
          value: 72,
          type: 'B'
        },
        {
          month: 'Sep.',
          value: 47,
          type: 'B'
        },
        {
          month: 'Oct.',
          value: 37,
          type: 'B'
        },
        {
          month: 'Nov.',
          value: 80,
          type: 'B'
        },
        {
          month: 'Dec.',
          value: 74,
          type: 'B'
        },
        {
          month: 'Jan.',
          value: 90,
          type: 'C'
        },
        {
          month: 'Feb.',
          value: 95,
          type: 'C'
        },
        {
          month: 'Mar.',
          value: 62,
          type: 'C'
        },
        {
          month: 'Apr.',
          value: 52,
          type: 'C'
        },
        {
          month: 'May.',
          value: 74,
          type: 'C'
        },
        {
          month: 'Jun.',
          value: 87,
          type: 'C'
        },
        {
          month: 'Jul.',
          value: 80,
          type: 'C'
        },
        {
          month: 'Aug.',
          value: 69,
          type: 'C'
        },
        {
          month: 'Sep.',
          value: 74,
          type: 'C'
        },
        {
          month: 'Oct.',
          value: 84,
          type: 'C'
        },
        {
          month: 'Nov.',
          value: 94,
          type: 'C'
        },
        {
          month: 'Dec.',
          value: 23,
          type: 'C'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  area: {
    visible: true,
    style: {
      fill: (datum, ctx) => {
        return datum.type === 'A' ? ctx.seriesColor(datum.type): false;
      }
    }
  },
  axes: [
    {
      orient: 'radius',
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true
      },
      grid: {
        smooth: true
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XOblbueMVou8l9xceKtcnJ6Ln5I.gif' alt='' width='1438' height='952'>

## 相关文档

*  [图元教程](https%3A%2F%2Fwww.visactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FSeries%2FMark)[ ](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FAxes)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>