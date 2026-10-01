---
title: How to support the display of total data in the Tooltip float layer?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question Title

How to support the display of total data in the Tooltip float layer?</br>
## Problem Description

In a chart, if you want to display the aggregated value of all the data, is it achievable?</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/YcybbleeEoxrv6xx1jvcCMO3nAc.gif' alt='' width='1460' height='1036'>

## Solution

In VChart, there are three types of tooltips:</br>
*  Group Tooltip (group)</br>
*  Dimension Tooltip (dimension)</br>
*  Graphical Element Tooltip (mark)</br>
For the display of aggregated data mentioned above, Group Tooltip and Dimension Tooltip are applicable, and custom display can be achieved through`tooltip.dimension.updateContent`.</br>
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
## Code Examples

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
## Result Display

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/G2o2b71Vxo2wUSx1ew4copEYnec.gif' alt='' width='1760' height='1042'>

## Related documents

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [tooltip configuration](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FbarChart%23tooltip.dimension.updateContent)</br>
*  [tooltip formatted content example](https%3A%2F%2Fvisactor.com%2Fvchart%2Fdemo%2Ftooltip%2Fformat-method)</br>