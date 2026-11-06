---
title: How to configure the style of the legend separately in VChart and change the shape of the graphic</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to configure the style of legends separately in VChart and change the shape of graphics</br>


## Problem description

How to change the legend item graphic of a column chart series to a circle</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HSpBbHYrYoJJkHx1L3TcBLZXnrc.gif' alt='' width='1488' height='1032'>

## Solution

Legends in VChart can be customized through the data configuration item, where the graphic property is in the `shape `property of the legend item</br>
```
 legends: {
    visible: true,
    data: items => {
      return items.map(item => {
        if(item.label === 'Under 5 Years'){
          item.shape.symbolType = 'circle';
        }
        return item;
      });
    },
  },</br>
```
## Code example

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
    visible: true,
    data: items => {
      return items.map(item => {
        if(item.label === 'Under 5 Years'){
          item.shape.symbolType = 'circle';
        }
        return item;
      });
    },
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


## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H5xGbVHuXottJMxndxIcFul2nUd.gif' alt='' width='1474' height='1038'>

## Related Documents

*  Configuration document: https://www.visactor.io/vchart/option/barChart-legends-discrete#data</br>
*  Related demo: https://www.visactor.io/vchart/demo/legend/custom-data</br>



