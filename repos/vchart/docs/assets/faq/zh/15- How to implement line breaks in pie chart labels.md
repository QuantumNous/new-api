---
title: 52. 饼图标签如何实现换行效果</br>
---
# 问题标题

饼图标签如何实现换行效果？</br>


## 问题描述

如何实现下面的饼图？标签需要支持两行的效果</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FRrabZnLxoqqIvxzSKacV64En6q.gif' alt='' width='1668' height='998'>



## 解决方案 

饼图标签支持格式化方法，在格式化方法中，我们可以通过在返回对象中设置`type: rich`将标签切换成富文本；富文本支持常见的换行、icon、image的展示；</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UsSvb1nqnoxVjTxlowxcqJconhe.gif' alt='' width='3356' height='1196'>



## 代码示例  

```
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '26.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
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
    formatMethod: (label, datum) => {
      return {
        type: 'rich',
        text: [{
          text: `${label}\n`,
          fontSize: 12,
          fill: '#8a8a8a',
          lineHeight: 20,
          fontWeight: 400
        }, {
          text: `${datum._percent_}%`,
          fill: '#121212',
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 22,
        }]
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

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/D30eb1AococGkaxIXM9cKi2wnwh.gif' alt='' width='1616' height='1062'>

## 相关文档

*  [富文本和 Dom 扩展](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FRichtext_and_Dom)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

