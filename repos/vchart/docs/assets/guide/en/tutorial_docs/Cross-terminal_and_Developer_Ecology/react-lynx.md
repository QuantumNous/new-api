# ReactLynx

**[Note] The open-source version of Lynx currently does not provide canvas functionality, so vchart rendering is not supported at the moment. It will be supported in future versions, so stay tuned. [For more features, please visit the Lynx official website](https://lynxjs.org/)**

Lynx is ByteDance's open-source high-performance cross-platform framework, which quickly builds native views based on the web technology stack. Lynx was officially open-sourced on March 5, 2025. ReactLynx is the React syntax version of Lynx. VChart, based on ByteDance's internal version ReactLynx3.0, provides chart rendering capabilities.

## How to get Lynx-VChart

### npm package

You can directly install the lynx-vchart dependency package (this package is an intranet package) in the ReactLynx project: @dp/lynx-vchart.

## Unified chart tag <VChart />

<VChart /> receives a complete **spec** as the chart definition, and its **spec** data structure is exactly the same as that of VChart, so developers can send any spec that is legal for VChart to Lynx-VChart for chart rendering.

Example:

```javascript
import VChart from '@dp/lynx-vchart';
export function PieChart() {
  const spec = {
    type: 'pie',
    data: [
      {
        id: 'id0',
        values: [
          { type: 'oxygen', value: '46.60' },
          { type: 'silicon', value: '27.72' },
          { type: 'aluminum', value: '8.13' },
          { type: 'iron', value: '5' },
          { type: 'calcium', value: '3.63' },
          { type: 'sodium', value: '2.83' },
          { type: 'potassium', value: '2.59' },
          { type: 'others', value: '3.5' }
        ]
      }
    ],
    outerRadius: 0.8,
    valueField: 'value',
    categoryField: 'type',
    title: {
      visible: true,
      text: 'Statistics of Surface Element Content'
    },
    legends: {
      visible: true,
      orient: 'left'
    },
    label: {
      visible: true
    },
    tooltip: {
      mark: {
        content: [
          {
            key: datum => datum['type'],
            value: datum => datum['value'] + '%'
          }
        ]
      }
    }
  };

  return (
    <div className="cusomized-pie-chart">
      <VChart spec={spec} onReady={() => console.log('ready')} width="700rpx" height="900rpx" />
    </div>
  );
}
```

### Props

If you already have a spec chart description, using the unified chart tag is a faster way, just import the VChart component:

```typescript
import VChart from '@dp/lynx-vchart';
```

The VChart component is the encapsulated ReactLynx component, and its props definition is as follows:

```typescript
interface VChartProps extends EventsProps {
  /** 图表定义 */
  spec: any;
  /** 图表配置 */
  options?: ChartOptions;
  /** 图表渲染完成事件 */
  onReady?: (instance: VChart, isInitial: boolean) => void;
  /** throw error when chart run into an error */
  onError?: (err: Error) => void;
  /**
   * 切换到同步渲染
   *
   * @since 1.8.3
   **/
  useSyncRender?: boolean;
  /**
   * props更新的时候，跳过所有函数的检查，即所有的函数都认为没有更新
   *
   * @since 1.6.5
   **/
  skipFunctionDiff?: boolean;
}
```

onReady is a built-in callback event that is triggered when the chart is rendered or updated. Its input parameters represent the chart instance object and whether it is the first rendering.

For example, developers can register the callback events that need to be triggered on the chart instance during the first rendering to achieve chart interaction functions.

## `<VChartSimple />` tag with lazy loading

The usage of this tag is similar to `<VChart />`. This tag supports the lazy loading feature of VChart. When using it, you need to configure an additional `vchartConstructor` field to pass in the VChart.

```ts
import { VChartSimple } from '@dp/lynx-vchart';
import { VChart as VChartCore } from '@visactor/vchart/esm/core';

export default function Demo() {
  return (
    <view>
      <VChartSimple
        // vchart核心包
        vchartConstructor={VChartCore}
        width="700rpx"
        height="900rpx"
        spec={spec}
      />
    </view>
  );
}
```

Since this tag is a lazy loading tag, you need to register the charts you will use in advance, like:

```ts
import { registerAreaChart } from '@visactor/vchart/esm/chart';
import { VChart as VChartCore } from '@visactor/vchart/esm/core';

VChartCore.useRegisters([registerAreaChart]);
```

You can refer to the lazy loading tutorial for specific lazy loading strategies: https://visactor.io/vchart/guide/tutorial_docs/Load_on_Demand

## Theme style

If you use a custom theme in VChart, you can achieve it in two ways, one is to define the theme in spec, and the other is to register the theme through ThemeManager. Because in Lynx-VChart, there is no need to reference the VChart npm package. Therefore, Lynx-VChart exposes the VChart base class, named VChartCore, which is convenient for developers to register custom themes on the VChart base class through static methods.

Refer to VChart Theme for VChart theme configuration.

Note that for the case of using VChart on demand, it is recommended to directly call the VChart API to use the theme.

## Event Interaction

The top-level chart component, whether it is the unified chart label (VChart) or the syntax chart label (BarChart, etc.), supports the scene tree event `EventsProps` thrown by the underlying rendering layer on its Props.

The definition of `EventsProps` is as follows:

```ts
interface EventsProps {
  onPointerDown?: (e: any) => void | boolean;
  onPointerUp?: (e: any) => void | boolean;
  onPointerUpOutside?: (e: any) => void | boolean;
  onPointerTap?: (e: any) => void | boolean;
  onPointerOver?: (e: any) => void | boolean;
  onPointerMove?: (e: any) => void | boolean;
  onPointerEnter?: (e: any) => void | boolean;
  onPointerLeave?: (e: any) => void | boolean;
  onPointerOut?: (e: any) => void | boolean;
  onMouseDown?: (e: any) => void | boolean;
  onMouseUp?: (e: any) => void | boolean;
  onMouseUpOutside?: (e: any) => void | boolean;
  onMouseMove?: (e: any) => void | boolean;
  onMouseOver?: (e: any) => void | boolean;
  onMouseOut?: (e: any) => void | boolean;
  onMouseEnter?: (e: any) => void | boolean;
  onMouseLeave?: (e: any) => void | boolean;
  onPinch?: (e: any) => void | boolean;
  onPinchStart?: (e: any) => void | boolean;
  onPinchEnd?: (e: any) => void | boolean;
  onPan?: (e: any) => void | boolean;
  onPanStart?: (e: any) => void | boolean;
  onPanEnd?: (e: any) => void | boolean;
  onDrag?: (e: any) => void | boolean;
  onDragStart?: (e: any) => void | boolean;
  onDragEnter?: (e: any) => void | boolean;
  onDragLeave?: (e: any) => void | boolean;
  onDragOver?: (e: any) => void | boolean;
  onDragEnd?: (e: any) => void | boolean;
  onRightDown?: (e: any) => void | boolean;
  onRightUp?: (e: any) => void | boolean;
  onRightUpOutside?: (e: any) => void | boolean;
  onTouchStart?: (e: any) => void | boolean;
  onTouchEnd?: (e: any) => void | boolean;
  onTouchEndOutside?: (e: any) => void | boolean;
  onTouchMove?: (e: any) => void | boolean;
  onTouchCancel?: (e: any) => void | boolean;
  onPress?: (e: any) => void | boolean;
  onPressUp?: (e: any) => void | boolean;
  onPressEnd?: (e: any) => void | boolean;
  onSwipe?: (e: any) => void | boolean;
  onDrop?: (e: any) => void | boolean;
  onWeel?: (e: any) => void | boolean;
  onClick?: (e: any) => void | boolean;
  onDblClick?: (e: any) => void | boolean;
}
```

## Summary

Through this tutorial, you should have learned how to use VChart to create a simple bar chart in the LynxVChart project. At the same time,
