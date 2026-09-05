# 如何设置图表 Tooltip 显示内容的顺序？

## 问题描述

我正在使用 VChart，如下图所示，我应该如何给 dimension tooltip 中显示的数据项设置顺序？比如设置为 key 值的降序。

![tooltip](/vchart/faq/73-0.png)

## 解决方案

VChart 的 tooltip 提供 `updateContent` 回调支持对显示内容做任意修改，可以在 tooltip spec 中进行配置。在`updateContent` 回调中，显示内容以数组形式作为参数提供，你只需要进行修改后再返回新数组即可。这其中完全可以包括排序。可参考以下示例：

## 代码示例

```javascript livedemo
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
      updateContent: prev => {
        prev.sort((a, b) => a.value - b.value); // sort values in ascending order
        return prev;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

![demo](/vchart/faq/73-1.png)

## 相关文档

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

Demo page: [https://www.visactor.io/vchart/demo/bar-chart/stack-column](https://www.visactor.io/vchart/demo/bar-chart/stack-column)
