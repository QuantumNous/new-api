# 如何实现柱形图同维度数据前后重叠而不是堆叠效果？

## 问题描述

类似（[https://www.visactor.io/vchart/demo/bar-chart/stack-column](https://www.visactor.io/vchart/demo/bar-chart/stack-column)）这样的堆积柱状图，

![description](/vchart/faq/64-0.png)

想要实现不同颜色的柱子都从 y 轴 0 刻度开始画，前后重叠，而不是上下堆积，该如何实现？

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，只需要将控制堆叠的字段设置为 false 即可。

![solution](/vchart/faq/64-1.png)

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
    }
  }
};
```

## 结果展示

在线效果参考：[https://codesandbox.io/s/bar-chart-stack-false-cr6667](https://codesandbox.io/s/bar-chart-stack-false-cr6667)

![demo](/vchart/faq/64-2.gif)

## 相关文档

堆积柱形图 demo：[https://www.visactor.io/vchart/demo/bar-chart/stack-column](https://www.visactor.io/vchart/demo/bar-chart/stack-column)

柱形图教程：[https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar)

相关 api：[https://www.visactor.io/vchart/option/barChart#stack](https://www.visactor.io/vchart/option/barChart#stack)

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
