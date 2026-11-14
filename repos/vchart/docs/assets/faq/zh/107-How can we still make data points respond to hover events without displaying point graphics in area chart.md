# 面积图，如何不显示 point 图形 的情况下，仍然能让数据点响应 hover 事件？

## 问题描述

期望在面积图中不显示点，但是依然可以通过 vchart.on('pointerover', ...) 获取到点被 hover 的事件消息

## 解决方案

VChart 的图形配置 visible:false 后确实不会再响应交互事件。但是可以通过设置透明度为 0 的方式，使点不可见，但依然能响应交互事件

```ts
{
  point: {
     style: {
       fillOpacity: 0,
       strokeOpacity: 0,
     }
  }
}
```

## 代码示例

```javascript livedemo
const spec = {
  type: 'area',
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
  point: {
    style: {
      fillOpacity: 0,
      strokeOpacity: 0
    }
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [点的样式配置](https://www.visactor.io/vchart/option/areaChart#point.style.fillOpacity)
- [事件监听文档](https://www.visactor.io/vchart/api/API/event)
