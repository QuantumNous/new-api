---
title: 78.VChart堆积柱图如何调整Tooltip中内容的展示顺序？</br>
---
## 问题标题

VChart堆积柱图如何调整Tooltip中内容的展示顺序？</br>


## 问题描述

堆叠柱状图中，堆积的顺序好像和数据的顺序相反一样，然后 tooltip 又反过来，要怎么让柱子的颜色顺序和 tooltip 的顺序一致？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/W0e9byEEho1A4hxq8t1cVFsAnSd.gif' alt='' width='1526' height='1104'>

## 解决方案

对于堆积柱状图，可以有两个方案，使得tooltip中内容的顺序和柱子的堆积顺序一致：</br>
*  方案一：`stackInverse:true `调整堆积的顺序</br>
```
{
  stack: true,
  stackInverse: true
}</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZKcvb10Y2o6GG6xn5DpcIYO5nlh.gif' alt='' width='1466' height='1024'>

*  方案二：调整tooltip中元素的顺序</br>
```
tooltip: {
    dimension: {
      updateContent: (items) => {
        return items.reverse();
      }
    }
  }</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PgKmbiLsco6GeGxOQKFcJLWbnme.gif' alt='' width='1520' height='1070'>

## 代码示例 

*  方案一：</br>
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
  stackInverse: true,
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
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
*  方案二</br>
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
        return items.reverse();
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  [`stackInverse`](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FbarChart%23region.stackInverse)[配置项](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FbarChart%23region.stackInverse)</br>
*  [tooltip配置](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FbarChart%23tooltip.dimension.updateContent)</br>

