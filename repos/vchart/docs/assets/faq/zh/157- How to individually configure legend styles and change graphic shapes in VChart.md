---
title: 90. VChart 中如何单独配置图例的样式，改变图形的形状</br>
---
## 问题标题

VChart 中如何单独配置图例的样式，改变图形的形状</br>


## 问题描述

如何将柱图一个系列的图例项图形改成圆</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RmSNb231KobeWxxb3o0cw1hAnte.gif' alt='' width='1488' height='1032'>

## 解决方案

VChart 中图例可以通过data配置项自定义，其中图形属性在图例项的 `shape` 属性中</br>
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


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QCF7boZIgoWzhcxqGJqczNPknnc.gif' alt='' width='1474' height='1038'>

## 相关文档

*  配置文档：https://www.visactor.io/vchart/option/barChart-legends-discrete#data</br>
*  相关 demo：https://www.visactor.io/vchart/demo/legend/custom-data</br>



