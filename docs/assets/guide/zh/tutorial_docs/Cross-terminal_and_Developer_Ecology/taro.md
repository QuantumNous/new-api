# Taro VChart

[Taro](https://docs.taro.zone/docs/) 是目前使用得较多的跨端跨框架解决方案，VChart 专门为此基于 Taro 框架封装了对应的图表组件：`@visactor/taro-vchart`。

- 仓库地址：[taro-vchart](https://github.com/VisActor/VChart/tree/main/packages/taro-vchart)
- 示例地址：[taro-vchart-example](https://github.com/VisActor/taro-vchart-example)

## 环境要求

**Taro 版本: >= 3.3.17**

> taro 因为小版本有一些不兼容的 break change，所以尽量使用 3.3 版本

## 支持环境

|        | 微信 | 头条 | H5  | RN  | 百度 | 阿里系 |
| ------ | ---- | ---- | --- | --- | ---- | ------ |
| 支持度 | ✔️   | ✔️   | ✔️  | --  | --   | --     |

目前组件支持的环境有：**微信小程序**，**字节小程序**，**飞书小程序**，**浏览器**。

以上环境通过 `type` 属性进行声明，`type` 属性值及对应环境如下：

- `weapp` 微信小程序。
- `tt` 字节小程序。
- `lark` 飞书小程序。
- `h5` h5 移动端环境。
- `web` 浏览器环境。

### 跨端支持

用户如果需要跨多端支持, 需要根据 `Taro.getEnv()` 动态传入 `type` 属性.

```tsx
<VChart
  type={Taro.getEnv()}
  canvasId="chartId"
  spec={spec}
  style={{ height: '100%', width: '100%' }}
  onChartInit={chart => {}}
  onChartReady={chart => {}}
  onChartUpdate={chart => {}}
/>
```

### 版本要求

> taro 因为小版本有一些不兼容的 break change，所以尽量使用 3.3 版本

1. **微信小程序端**：需要确保 **Taro 版本 >= 3.3.17**
2. **字节小程序端**：需要确保 **Taro 版本 >= 3.3.17**
3. **飞书小程序端**：需要确保 **Taro 版本 >= 3.2.0**, **飞书版本 >= 3.45.0**

## 如何使用

### 安装

```
# npm
$ npm install @visactor/taro-vchart

# yarn
$ yarn add @visactor/taro-vchart
```

### 快速上手

`@visactor/taro-vchart` 图表组件的方式非常简单，步骤如下：

1. 引入图表组件：`import VChart from '@visactor/taro-vchart'`
2. 声明图表组件，声明必要的属性
   - `type` 属性用于声明所在的环境参数，可以不声明，内部默认会使用 `Taro.getEnv()`
   - `canvasId` 必传，用来识别内部的 canvas 组件
   - `spec` 为对应的 VChart 图表配置项

下面是一个柱图的实例代码，具体可以 download 我们的实例项目：[taro-vchart-example](https://github.com/VisActor/taro-vchart-example)，实地运行体验。

```tsx
import { VChart } from '@visactor/taro-vchart';
import Taro from '@tarojs/taro';

// VChart 图表配置项
const barSpec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start'
  }
};

export const BarChart = () => {
  return (
    <VChart
      type={Taro.getEnv() as any}
      style={{ width: '100%', height: '150px' }}
      spec={barSpec}
      canvasId="bar-chart"
      onChartReady={() => {
        console.log('onChartReady');
      }}
    />
  );
};
```

## API

图表组件使用示例如下：

```tsx
<VChart
  type="tt"
  spec={spec}
  canvasId="pie"
  style={{ height: '35vh', width: '100%' }}
  onChartInit={chart => {
    console.log('init pie');
  }}
  onChartReady={chart => {
    console.log('ready pie');
  }}
  onChartUpdate={chart => {
    console.log('update pie');
  }}
/>
```

| API           | 类型     | 是否必填 | 说明                                                                                                                                            |
| ------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| type          | string   | 否       | 配置的环境，目前组件支持的环境有：**微信小程序**('weapp')，**字节小程序**('tt')，**飞书小程序**('lark')，**浏览器**('web')，**h5 移动端**('h5') |
| canvasId      | String   | 是       | 图表 id, 必确唯一                                                                                                                               |
| spec          | Object   | 是       | 图表配置项, 请参考[VChart 配置项](../../../option)                                                                                              |
| style         | Object   | 否       | 图表容器样式                                                                                                                                    |
| events        | Object[] | 否       | 事件绑定配置                                                                                                                                    |
| options       | Object   | 否       | 初始化 VChart 实例传入的额外配置项，同 [VChart 实例化配置项](/vchart/api/API/vchart#options)                                                    |
| onChartInit   | Function | 否       | 图表初始化完后触发的回调                                                                                                                        |
| onChartReady  | Function | 否       | 图表渲染完毕后触发的回调                                                                                                                        |
| onChartUpdate | Function | 否       | 图表更新完毕后触发的回调                                                                                                                        |

## 常用示例

### 图表状态更新

图表内部, 监听了 `spec` 的变化. 当 spec 变化时, 则会基于新的 `spec` 更新图表。

此外用户也可以使用 VChart 实例提供的渲染接口，进行图表的渲染、更新、销毁操作。

> 可以通过 `onChartInit` 接口, 获取到 VChart 实例.

#### API

- `chartInstance.renderAsync()` 更新图表

- `chartInstance.release()` 销毁图表

- `chartInstance.updateSpec()` 基于 Spec 更新图表

- `chartInstance.updateData()` 基于数据更新图表

详细使用方法请参考:[VChart API](/vchart/api/API)

#### 示例

兼容 React 的状态管理方式. 通过 setState 更新配置项, 图表即可重绘.

```tsx
import React, { useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import VChart from '@visactor/taro-vchart';

export function Pie() {
  const [spec, setSpec] = useState({
    data: [
      {
        id: 'data1',
        values: [
          {
            value: 335,
            name: '直接访问'
          },
          {
            value: 310,
            name: '邮件营销'
          },
          {
            value: 274,
            name: '联盟广告'
          },
          {
            value: 235,
            name: '视频广告'
          },
          {
            value: 400,
            name: '搜索引擎'
          }
        ]
      }
    ],
    type: 'pie',
    outerRadius: 0.6,
    innerRadius: 0.5,
    categoryField: 'name',
    valueField: 'value',
    legends: {
      visible: true
    }
  });

  useEffect(() => {
    setTimeout(() => {
      setSpec({
        data: [
          {
            id: 'data1',
            values: [
              {
                value: 335,
                name: '直接访问'
              },
              {
                value: 310,
                name: '邮件营销'
              }
            ]
          }
        ],
        type: 'pie',
        outerRadius: 0.6,
        innerRadius: 0.5,
        categoryField: 'name',
        valueField: 'value',
        legends: {
          visible: true
        }
      });
    }, 3000);
  }, []);

  return (
    <View
      style={{
        border: '1px solid #eeeeee',
        width: '90vw'
      }}
    >
      <VChart
        type="tt"
        spec={spec}
        canvasId="pie"
        style={{ height: '35vh', width: '100%' }}
        onChartInit={() => {
          console.log('init pie');
        }}
        onChartReady={() => {
          console.log('ready pie');
        }}
        onChartUpdate={() => {
          console.log('update pie');
        }}
      />
    </View>
  );
}
```

## 按需加载

taro-VChart 本身代码都支持按需加载，当需要 VChart 按需加载的时候，有两种办法：

- 使用 `<VChartSimple />` 标签，实现自定义的按需加载

> 自**1.10.0**版本开始支持

`<VChartSimple />`组件和`<VChart />`组件使用方法基本完全相同，唯一差异点为，需要用户从 `@viasctor/vchart/esm/core` 引用 `VChart` 构造类，根据本文描述，注册需要的图表和组件，并传入给 `<VChartSimple />`;

- 使用语义化标签，，所有的语义化标签默认支持按需加载，其中各种语义化标签默认注册的内容如下：

> 自**1.12.0**版本开始支持

| 图表                       | 分类           | 额外注册的组件                        |
| -------------------------- | -------------- | ------------------------------------- |
| `<LineChart/>`             | 直角坐标系图表 | `registerLabel`                       |
| `<AreaChart/>`             | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<BarChart/>`              | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<Bar3dChart/>`            | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<BoxPlotChart/>`          | 直角坐标系图表 | `registerLabel`,                      |
| `<HeatmapChart/>`          | 直角坐标系图表 | `registerLabel`                       |
| `<Histogram3dChart/>`      | 直角坐标系图表 | `registerLabel`                       |
| `<HistogramChart/>`        | 直角坐标系图表 | `registerLabel`                       |
| `<LinearProgressChart/>`   | 直角坐标系图表 | `registerLabel`                       |
| `<RangeColumnChart/>`      | 直角坐标系图表 | `registerLabel`                       |
| `<RangeColumn3dChart/>`    | 直角坐标系图表 | `registerLabel`                       |
| `<ScatterChart/>`          | 直角坐标系图表 | `registerLabel`                       |
| `<SequenceChart/>`         | 直角坐标系图表 | `registerLabel`                       |
| `<WaterfallChart/>`        | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<RadarChart/>`            | 极坐标系图表   | `registerLabel`                       |
| `<RoseChart/>`             | 极坐标系图表   | `registerLabel`                       |
| `<CircularProgressChart/>` | 极坐标系图表   | `registerLabel`, `registerIndicator`  |
| `<Pie3dChart/>`            | 通用图表       | `registerLabel`, `registerIndicator`  |
| `<PieChart/>`              | 通用图表       | `registerLabel`, `registerIndicator`  |
| `<CirclePackingChart/>`    | 通用图表       | 无                                    |
| `<FunnelChart/>`           | 通用图表       | `registerLabel`                       |
| `<Funnel3dChart/>`         | 通用图表       | `registerLabel`                       |
| `<GaugeChart/>`            | 通用图表       | 无                                    |
| `<MapChart/>`              | 通用图表       | `registerLabel`                       |
| `<SankeyChart/>`           | 通用图表       | 无                                    |
| `<SunburstChart/>`         | 通用图表       | 无                                    |
| `<TreemapChart/>`          | 通用图表       | 无                                    |
| `<VennChart/>`             | 通用图表       | 无                                    |
| `<WordCloud3dChart/>`      | 通用图表       | 无                                    |
| `<WordCloudChart/>`        | 通用图表       | 无                                    |
| `<LiquidChart/>`           | 通用图表       | `registerIndicator`                   |

其中，直角坐标系图表默认注册组件如下：

- `registerCartesianLinearAxis`
- `registerCartesianBandAxis`
- `registerCartesianTimeAxis`
- `registerCartesianLogAxis`
- `registerCartesianCrossHair`
- `registerBrush`
- `registerContinuousLegend`
- `registerDataZoom`
- `registerDiscreteLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerMarkArea`
- `registerMarkLine`
- `registerMarkPoint`
- `registerScrollBar`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

极坐标系图表默认注册组件如下：

- `registerPolarLinearAxis`
- `registerPolarBandAxis`
- `registerPolarCrossHair`
- `registerBrush`
- `registerContinuousLegend`
- `registerDataZoom`
- `registerDiscreteLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerScrollBar`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

通用图表默认注册组件如下：

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

使用语义化标签的时候，如果用到其他没有默认加载的组件，只需要注册未加载的组件即可；

VChart 按需引用参考[相关文档](/vchart/guide/tutorial_docs/Load_on_Demand)
