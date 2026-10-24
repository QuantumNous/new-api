# Taro VChart

[Taro](https://docs.taro.zone/docs/) is a commonly used cross-end and cross-frame solution. VChart specially encapsulates the corresponding chart component based on the Taro framework: `@visactor/taro-vchart`.

- Warehouse address: [taro-vchart](https://github.com/VisActor/VChart/tree/main/packages/taro-vchart)
- Example address: [taro-vchart-example](https://github.com/VisActor/taro-vchart-example)

## Environmental requirements

**Taro version: >= 3.3.17**

> taro Because the minor version has some incompatible break changes, try to use version 3.3

## Support environment

|         | WeChat | Headlines | H5  | RN  | Baidu | Alibaba |
| ------- | ------ | --------- | --- | --- | ----- | ------- |
| Support | ✔️     | ✔️        | ✔️  | --  | --    | --      |

The environments currently supported by the component include: **WeChat Mini Program**, **Byte Mini Program**, **Feishu Mini Program**, and **Browser**.

The above environment is declared through the `type` attribute. The `type` attribute value and corresponding environment are as follows:

- `weapp` WeChat applet.
- `tt` byte applet.
- `lark` Feishu applet.
- `h5` h5 mobile environment.
- `web` browser environment.

### Cross-end support

If users need cross-terminal support, they need to dynamically pass in the `type` attribute according to `Taro.getEnv()`.

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

### Version requirements

> taro Because the minor version has some incompatible break changes, try to use version 3.3

1. **WeChat Mini Program**: Need to ensure **Taro version >= 3.3.17**
2. **Byte applet**: Need to ensure that **Taro version >= 3.3.17**
3. **Feishu Mini Program**: You need to ensure that **Taro version >= 3.2.0**, **Feishu version >= 3.45.0**

## how to use

### Install

```
# npm
$ npm install @visactor/taro-vchart

# yarn
$ yarn add @visactor/taro-vchart
```

### Get started quickly

`@visactor/taro-vchart` The method of chart component is very simple, the steps are as follows:

1. Introduce chart component: `import VChart from '@visactor/taro-vchart'`
2. Declare the chart component and declare necessary attributes
   - The `type` attribute is used to declare the environment parameters. It does not need to be declared. `Taro.getEnv()` will be used by default internally.
   - `canvasId` must be passed, used to identify the internal canvas component
   - `spec` is the corresponding VChart chart configuration item

The following is an example code for a column chart. For details, you can download our example project: [taro-vchart-example](https://github.com/VisActor/taro-vchart-example) for field running experience.

```tsx
import { VChart } from '@visactor/taro-vchart';
import Taro from '@tarojs/taro';

// VChart chart configuration items
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

Examples of using the chart component are as follows:

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

| API           | Type     | Is it required | Description                                                                                                                                                                                                                       |
| ------------- | -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type          | string   | No             | The configured environment. Currently, the environments supported by the component are: **WeChat mini program** ('weapp'), **Byte mini program** ('tt'), **Feishu mini program**('lark'), **browser**('web'), **h5 mobile**('h5') |
| canvasId      | String   | Yes            | Chart id, must be unique                                                                                                                                                                                                          |
| spec          | Object   | Yes            | Chart configuration items, please refer to [VChart configuration items](../../../option)                                                                                                                                          |
| style         | Object   | No             | Chart container style                                                                                                                                                                                                             |
| events        | Object[] | No             | Event binding configuration                                                                                                                                                                                                       |
| options       | Object   | No             | Additional configuration items passed in to initialize the VChart instance, the same as [VChart instantiation configuration items](/vchart/api/API/vchart#options)                                                               |
| onChartInit   | Function | No             | Callback triggered after chart initialization                                                                                                                                                                                     |
| onChartReady  | Function | No             | Callback triggered after the chart is rendered                                                                                                                                                                                    |
| onChartUpdate | Function | No             | Callback triggered after the chart is updated                                                                                                                                                                                     |

## Common examples

### Chart status update

Inside the chart, changes in `spec` are monitored. When spec changes, the chart will be updated based on the new `spec`.

In addition, users can also use the rendering interface provided by the VChart instance to render, update, and destroy charts.

> The VChart instance can be obtained through the `onChartInit` interface.

#### API

- `chartInstance.renderAsync()` updates the chart

- `chartInstance.release()` destroys the chart

- `chartInstance.updateSpec()` updates the chart based on Spec

- `chartInstance.updateData()` updates the chart based on data

For detailed usage, please refer to: [VChart API](/vchart/api/API)

#### Example

Compatible with React's state management method. Update configuration items through setState, and the chart can be redrawn.

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


## On-Demand Loading

Taro-VChart inherently supports on-demand loading. When on-demand loading of VChart is required, there are two methods:

- Use the `<VChartSimple />` tag to implement custom on-demand loading.

> Supported from version **1.10.0**

The `<VChartSimple />` component and the `<VChart />` component are almost identical in usage. The only difference is that users need to import the `VChart` constructor class from `@viasctor/vchart/esm/core`, register the required charts and components as described in this document, and pass them to `<VChartSimple />`.

- Use semantic tags, all of which support on-demand loading by default. The default registered components for each type of semantic tag are as follows:

> Supported from version **1.12.0**

| Chart                        | Category         | Additional Registered Components     |
| ---------------------------- | ---------------- | ------------------------------------ |
| `<LineChart/>`               | Cartesian Charts | `registerLabel`                      |
| `<AreaChart/>`               | Cartesian Charts | `registerLabel`, `registerTotalLabel`|
| `<BarChart/>`                | Cartesian Charts | `registerLabel`, `registerTotalLabel`|
| `<Bar3dChart/>`              | Cartesian Charts | `registerLabel`, `registerTotalLabel`|
| `<BoxPlotChart/>`            | Cartesian Charts | `registerLabel`,                     |
| `<HeatmapChart/>`            | Cartesian Charts | `registerLabel`                      |
| `<Histogram3dChart/>`        | Cartesian Charts | `registerLabel`                      |
| `<HistogramChart/>`          | Cartesian Charts | `registerLabel`                      |
| `<LinearProgressChart/>`     | Cartesian Charts | `registerLabel`                      |
| `<RangeColumnChart/>`        | Cartesian Charts | `registerLabel`                      |
| `<RangeColumn3dChart/>`      | Cartesian Charts | `registerLabel`                      |
| `<ScatterChart/>`            | Cartesian Charts | `registerLabel`                      |
| `<SequenceChart/>`           | Cartesian Charts | `registerLabel`                      |
| `<WaterfallChart/>`          | Cartesian Charts | `registerLabel`, `registerTotalLabel`|
| `<RadarChart/>`              | Polar Charts     | `registerLabel`                      |
| `<RoseChart/>`               | Polar Charts     | `registerLabel`                      |
| `<CircularProgressChart/>`   | Polar Charts     | `registerLabel`, `registerIndicator` |
| `<Pie3dChart/>`              | General Charts   | `registerLabel`, `registerIndicator` |
| `<PieChart/>`                | General Charts   | `registerLabel`, `registerIndicator` |
| `<CirclePackingChart/>`      | General Charts   | None                                 |
| `<FunnelChart/>`             | General Charts   | `registerLabel`                      |
| `<Funnel3dChart/>`           | General Charts   | `registerLabel`                      |
| `<GaugeChart/>`              | General Charts   | None                                 |
| `<MapChart/>`                | General Charts   | `registerLabel`                      |
| `<SankeyChart/>`             | General Charts   | None                                 |
| `<SunburstChart/>`           | General Charts   | None                                 |
| `<TreemapChart/>`            | General Charts   | None                                 |
| `<VennChart/>`               | General Charts   | None                                 |
| `<WordCloud3dChart/>`        | General Charts   | None                                 |
| `<WordCloudChart/>`          | General Charts   | None                                 |
| `<LiquidChart/>`             | General Charts   | `registerIndicator`                  |

For Cartesian charts, the default registered components are as follows:

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

For Polar charts, the default registered components are as follows:

- `registerPolarLinearAxis`
- `registerPolarBandAxis`
- `registerPolarCrossHair`
- `registerBrush`
- `registerContinuous Legend`
- `registerDataZoom`
- `registerDiscreteLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerScrollBar`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

For General charts, the default registered components are as follows:

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

When using semantic tags, if you need components that are not loaded by default, you only need to register the missing components.

For reference on on-demand loading of VChart, see [related documentation](/vchart/guide/tutorial_docs/Load_on_Demand).
