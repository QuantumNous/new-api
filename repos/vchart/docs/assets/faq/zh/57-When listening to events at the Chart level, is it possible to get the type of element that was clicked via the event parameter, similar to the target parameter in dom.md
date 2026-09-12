# 在 Chart 层面监听事件，是否可以通过 event 参数获取具体点击的元素类型，类似于 dom 的 target 参数？

## 问题描述

能通过监听整个 chart 或 canvas，然后根据返回的参数，比如 type 来判断 点击的是 axis/legend/item 吗？

## 解决方案

可以实现的，VChart 实例上提供了事件的注册和卸载，您可以通过
`chart.on(event: string, callback: (params: EventParams)=> void): void`监听不同的事件类型，并通过回调函数拿到上下文信息。如果要区分您是在 axis/legend/item 上触发的不同事件，可以事件过滤来实现，并传入`{ level: 'model' | 'mark', type: 'axis' }`，
其中`'model'`表示图表组成元素模型类型，`'mark'`表示图表 item 元素。
比如：`vchart.on('pointerdown', { level: 'model', type: 'axis' }, (params) => {})`。
当我点击了坐标轴，便可以拿到具体的参数。

更多的事件类型及参数可以参考：https://www.visactor.io/vchart/api/event。

[event](/vchart/faq/8-0.png)

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
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

vchart.on('pointerdown', { level: 'model', type: 'axis' }, params => {
  console.log('params', params);
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [事件教程](https://www.visactor.io/vchart/guide/event)
- [相关 api](https://www.visactor.io/vchart/api/event)
- [github](https://github.com/VisActor/VChart)
