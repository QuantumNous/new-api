---
title: 36. 当使用堆叠柱状图时，如何在点击事件中获取与被点击柱子同维度的所有数据</br>
---
## 问题标题

当使用堆叠柱状图时，如何在点击事件中获取与被点击柱子同维度的所有数据？</br>


## 问题描述

当使用堆叠柱状图时，如何在点击事件中获取与被点击柱子同维度的所有数据？比如点击第一个柱子，返回包含蓝、青、红、绿四种图例所代表的四条数据。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/LzG4bpIHsoGqLlxU15CcfYBWn2d.gif' alt='' width='2260' height='1114'>

## 解决方案 

在 VChart 中首先可以先通过监听柱子的点击事件拿到被点击柱子的 x 轴维度信息，然后通过 api 或者直接使用原始数据（如果你能拿到）获取当前图表的数据，然后进行过滤，筛选出同 x 轴维度信息相同的柱子数据即可。如下：</br>
```
// 监听 bar 图元的 click 事件
vchart.on('click', { markName: 'bar', level: 'mark' }, (e: any) => {
  const datum = e.datum as any; // 获取被点击的柱子的信息
  const chartSpec = e.chart?.getSpec(); // 如果你无法获取当前的 spec，可以通过该方式获取原始 spec
  const xDimensionValue = datum[chartSpec.xField];
  const chartData = e.chart.chartData.getSeriesData().latestData; // 如果可以拿到原始数据，也可以直接拿原始数据
  const filterData = chartData.filter(chartDatum => chartDatum[chartSpec.xField] === xDimensionValue);

  console.log(filterData);
});
</br>
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
  }
};

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();


// 监听 bar 图元的 click 事件
vchart.on('click', { markName: 'bar', level: 'mark' }, (e: any) => {
  const datum = e.datum as any; // 获取被点击的柱子的信息
  const chartSpec = e.chart?.getSpec(); // 如果你无法获取当前的 spec，可以通过该方式获取原始 spec
  const xDimensionValue = datum[chartSpec.xField];
  const chartData = e.chart.chartData.getSeriesData().latestData; // 如果可以拿到原始数据，也可以直接拿原始数据
  const filterData = chartData.filter(chartDatum => chartDatum[chartSpec.xField] === xDimensionValue);

  console.log(filterData);
});</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DCyEbHQzioOs8Dx8GKhcHYW4n0d.gif' alt='' width='3834' height='1844'>



## 相关文档

*  教程：https://visactor.io/vchart/api/API/event#%E4%BA%8B%E4%BB%B6%E8%BF%87%E6%BB%A4</br>
*  API：https://visactor.io/vchart/api/API/event#%E4%BA%8B%E4%BB%B6%E8%BF%87%E6%BB%A4</br>
*  Github：https://github.com/VisActor/VChart/</br>



