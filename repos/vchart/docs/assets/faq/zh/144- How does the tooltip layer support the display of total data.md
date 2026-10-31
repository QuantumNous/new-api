---
title: 80.Tooltip浮层如何支持总计数据的展示？</br>
---
## 问题标题

Tooltip浮层如何支持总计数据的展示？</br>


## 问题描述

在图表中，如果想要展示所有数据的汇总值，可以实现吗</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Kxzeb4SgNohe0sx0U9zcJFDAnqe.gif' alt='' width='1460' height='1036'>

## 解决方案

VChart中，tooltip存在三种类型：</br>
*  分组Tooltip (group)</br>
*  维度Tooltip (dimension)</br>
*  图元Tooltip (mark)</br>
针对上面提到的汇总数据的展示，适用于分组tooltip和维度tooltip，那就可以通过`tooltip.dimension.updateContent`来进行自定义的展示</br>
```
tooltip: {
    dimension: {
      updateContent: (items) => {
        const total = items.reduce((sum, item) => {
          return +item.value + sum;
        }, 0)
        return [
          {
            ...items[0],
            key: '总计',
            value: total,
            hasShape: false,
          },
          ...items
        ];
      }
    }
  }</br>
```
## 代码示例

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  stack: true,
  legends: {
    visible: true
  },
  bar: {
    // The state style of bar
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  tooltip: {
    dimension: {
      updateContent: (items) => {
        const total = items.reduce((sum, item) => {
          return +item.value + sum;
        }, 0)
        return [
          {
            ...items[0],
            key: '总计',
            value: total,
            hasShape: false,
          },
          ...items
        ];
      }
    }
  }
};</br>
```
## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PCdObwWKVo5OWBx1pOoctzM1ndh.gif' alt='' width='1760' height='1042'>

## 相关文档

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [tooltip配置](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FbarChart%23tooltip.dimension.updateContent)</br>
*  [tooltip 格式化内容示例](https%3A%2F%2Fvisactor.com%2Fvchart%2Fdemo%2Ftooltip%2Fformat-method)</br>