# 如何在图表中配置一个能够在移动端响应的 DataZoom 组件？

## 问题描述

类似 [这样](https://www.visactor.io/vchart/demo/line-chart/basic-line)的简单线图，

![line chart](/vchart/faq/25-0.png)

怎么配置 DataZoom 组件？DataZoom 组件可以在移动端设备进行交互吗？

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，在 VChart 中只需要配置 **dataZoom** ，就会展示组件；为了移动端的交互更加友好，可以开启`roam: true`的配置。

![line chart](/vchart/faq/25-1.png)

## 代码示例

```
const spec = {
  type: "line",
  data: {
    values: [
      {
        time: "2:00",
        value: 8
      },
      {
        time: "4:00",
        value: 9
      },
      {
        time: "6:00",
        value: 11
      },
      {
        time: "8:00",
        value: 14
      },
      {
        time: "10:00",
        value: 16
      },
      {
        time: "12:00",
        value: 17
      },
      {
        time: "14:00",
        value: 17
      },
      {
        time: "16:00",
        value: 16
      },
      {
        time: "18:00",
        value: 15
      }
    ]
  },
  xField: "time",
  yField: "value",
  dataZoom: [
    {
      orient: "bottom",
      filterMode: "filter",
      roam: true
    }
  ]
};
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/line-chart-datazoom-wzk8n7)

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  dataZoom: [
    {
      orient: 'bottom',
      filterMode: 'filter',
      roam: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## 相关文档

- [DataZoom demo](https://www.visactor.io/vchart/demo/data-zoom/preview-data?keyword=dataZoom)
- [DataZoom 教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/DataZoom)
- [相关配置](https://www.visactor.io/vchart/option/lineChart#dataZoom.valueField)
- [github](https://github.com/VisActor/VChart)
