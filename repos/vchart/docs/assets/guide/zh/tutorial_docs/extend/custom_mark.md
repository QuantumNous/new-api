# 自定义 mark

图表的自定义 mark 功能，可以让用户在图表上添加自定义的标记，比如添加一些文本、图片、线段等。

## 配置接口

自定义 mark 的配置，在 spec 的最上层，通过 `mark` 字段进行配置。

```typescript
const spec = {
  customMark: {
    type: T; // 支持的类型请见下方详细介绍
    /** 关联的数据索引 */
    dataIndex?: number;
    /** 关联的数据id，有次配置时 dataIndex无效 */
    dataId?: StringOrNumber;
    /** 图表系列 mark 支持的配置 */
    /** 用户id */
    id?: StringOrNumber;
    /** 是否响应交互 */
    interactive?: boolean;
    /** 与其他mark元素的层级 */
    zIndex?: number;
    /** mark 层 是否显示配置 */
    visible?: boolean;
    /** 默认样式设置 */
    style?: ConvertToMarkStyleSpec<T>;
    /** 不同状态下的样式配置 */
    state?: Record<StateValue, IMarkStateSpec<T> | IMarkStateStyleSpec<T>>;
  };
}
```

除了需要配置 mark 的类型，以及可选的数据外，其他的配置项与系列的 mark 没有区别。

目前支持的 mark 类型如下

- `symbol` 点图形
- `rule` 一个线段，需要指定起点和终点
- `text` 文本
- `rect` 矩形
- `path` 路径
- `arc` 扇区
- `polygon` 多边形
- `group` 组，可以将其他 mark 放到组下

## 使用示例

在一些场景中，我们会期望展示一下额外的信息，下面的例子使用了自定义 mark，展示数据中的年份

```javascript livedemo
const goldenMedals = {
  2000: [
    { country: 'USA', value: 37 },
    { country: 'Russia', value: 32 },
    { country: 'China', value: 28 },
    { country: 'Australia', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 13 },
    { country: 'Italy', value: 13 },
    { country: 'Netherlands', value: 12 },
    { country: '古巴', value: 11 },
    { country: 'U.K.', value: 11 }
  ],
  2004: [
    { country: 'USA', value: 36 },
    { country: 'China', value: 32 },
    { country: 'Russia', value: 28 },
    { country: 'Australia', value: 17 },
    { country: 'Japan', value: 16 },
    { country: 'Germany', value: 13 },
    { country: 'France', value: 11 },
    { country: 'Italy', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'U.K.', value: 9 }
  ],
  2008: [
    { country: 'China', value: 48 },
    { country: 'USA', value: 36 },
    { country: 'Russia', value: 24 },
    { country: 'U.K.', value: 19 },
    { country: 'Germany', value: 16 },
    { country: 'Australia', value: 14 },
    { country: 'South Korea', value: 13 },
    { country: 'Japan', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'France', value: 7 }
  ],
  2012: [
    { country: 'USA', value: 46 },
    { country: 'China', value: 39 },
    { country: 'U.K.', value: 29 },
    { country: 'Russia', value: 19 },
    { country: 'South Korea', value: 13 },
    { country: 'Germany', value: 11 },
    { country: 'France', value: 11 },
    { country: 'Australia', value: 8 },
    { country: 'Italy', value: 8 },
    { country: 'Hungary', value: 8 }
  ],
  2016: [
    { country: 'USA', value: 46 },
    { country: 'U.K.', value: 27 },
    { country: 'China', value: 26 },
    { country: 'Russia', value: 19 },
    { country: 'Germany', value: 17 },
    { country: 'Japan', value: 12 },
    { country: 'France', value: 10 },
    { country: 'South Korea', value: 9 },
    { country: 'Italy', value: 8 },
    { country: 'Australia', value: 8 }
  ],
  2020: [
    { country: 'USA', value: 39 },
    { country: 'China', value: 38 },
    { country: 'Japan', value: 27 },
    { country: 'U.K.', value: 22 },
    { country: 'Russian Olympic Committee', value: 20 },
    { country: 'Australia', value: 17 },
    { country: 'Netherlands', value: 10 },
    { country: 'France', value: 10 },
    { country: 'Germany', value: 10 },
    { country: 'Italy', value: 10 }
  ]
};

const dataSpecs = Object.keys(goldenMedals).map(year => {
  return {
    data: [
      {
        id: 'id',
        values: goldenMedals[year].sort((a, b) => b.value - a.value)
      },
      {
        id: 'year',
        values: [{ year }]
      }
    ]
  };
});
const duration = 2000;
const spec = {
  type: 'bar',
  padding: {
    top: 12,
    right: 100,
    bottom: 12
  },
  data: dataSpecs[0].data,
  direction: 'horizontal',
  yField: 'country',
  xField: 'value',
  seriesField: 'country',
  axes: [
    {
      animation: true,
      orient: 'bottom',
      type: 'linear',
      visible: true,
      grid: {
        visible: true
      }
    },
    {
      animation: true,
      id: 'axis-left',
      orient: 'left',
      width: 130,
      tick: { visible: false },
      label: { visible: true },
      type: 'band'
    }
  ],
  title: {
    visible: true,
    text: 'Top 10 Olympic Gold Medals by Country Since 2000'
  },
  animationUpdate: {
    bar: [
      {
        type: 'update',
        options: { excludeChannels: ['x', 'y'] },
        duration
      },
      {
        channel: ['x', 'y'],
        options: { excludeChannels: ['width'] },
        duration: 500
      }
    ],
    axis: {
      duration: 500,
      easing: 'linear'
    }
  },
  customMark: [
    {
      type: 'text',
      dataId: 'year',
      style: {
        textBaseline: 'bottom',
        fontSize: 200,
        textAlign: 'right',
        fontFamily: 'PingFang SC',
        fontWeight: 600,
        text: datum => datum.year,
        x: () => {
          return vchart.getChart().getCanvasRect()?.width - 50;
        },
        y: () => {
          return vchart.getChart().getCanvasRect()?.height - 50;
        },
        fill: 'grey',
        fillOpacity: 0.5
      }
    }
  ],
  player: {
    type: 'continuous',
    orient: 'bottom',
    auto: true,
    loop: true,
    dx: 80,
    position: 'middle',
    interval: duration,
    specs: dataSpecs,
    slider: {
      railStyle: {
        height: 6
      }
    },
    controller: {
      backward: {
        style: {
          size: 12
        }
      },
      forward: {
        style: {
          size: 12
        }
      },
      start: {
        order: 1,
        position: 'end'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```
