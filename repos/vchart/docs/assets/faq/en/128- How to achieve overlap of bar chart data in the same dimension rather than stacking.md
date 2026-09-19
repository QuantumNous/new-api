---
title: 0. How to achieve a bar chart similar to the stacked column chart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to achieve a bar chart similar to the stacked column chart</br>


## Description

Seemly to https://www.visactor.io/vchart/demo/bar-chart/stack-column,  how to make bars of different colors start from the y-axis zero scale and overlap with each other rather than stacking vertically?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HbpVbp1HroQTRAxL33mcqo2an7e.gif' alt='' width='812' height='510'>





## Solution

The solution varies depending on the chart library being used. Based on the provided demo, you simply need to set the corresponding field to false in order to disable stacking.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/IkPqbHLOoo0tMpxth37cjCOIn2b.gif' alt='' width='331' height='457'>



## Code Example

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
  stack: false,
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
    },
    
  }
};</br>
```
## Results

Online demo：https://codesandbox.io/s/bar-chart-stack-false-cr6667</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AKy3bMbbOoUloVx8UiQcvukRn9c.gif' alt='' width='756' height='640'>



## Related Documentation





Stacked Bar Chart Demo：https://www.visactor.io/vchart/demo/bar-chart/stack-column</br>
Bar Chart Tutorial：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar</br>
Related api：https://www.visactor.io/vchart/option/barChart#stack</br>
github：https://github.com/VisActor/VChart</br>

