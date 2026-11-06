# 自定义布局

VChart 支持用户自定义布局，图表的所有布局元素都可以任意设置位置。下面详细的介绍如何使用

## 配置

目前支持在 VChart 初始化时，在图表的初始化参数上配置 `layout` 属性，进行自定义布局。它的类型定义如下

```ts
export type LayoutFunction = (chart: VChart, item: LayoutItem[], chartLayoutRect: BBox, chartViewBox: BBox) => void;
```

## 布局元素

在布局过程中 ，图表会调用上方传入的自定义布局函数，传入一个 `LayoutItem[]` 数组，数组中的每个元素都是一个布局元素，它的类型定义如下

```ts
type ILayoutType = 'region-relative' | 'region' | 'normal' | 'absolute';

export interface ILayoutItem {
  /** 布局类型 */
  layoutType: ILayoutType;
  // 越大的应该越先处理
  layoutLevel: number;
  /** 得到元素的当前布局起点 */
  getLayoutStartPoint: () => ILayoutPoint;
  /** 得到元素的当前布局大小 */
  getLayoutRect: () => ILayoutRect;
  /** 更新元素布局的 layoutRect 大小，用来更新指定布局空间 */
  setLayoutRect: (rect: Partial<ILayoutRect>, levelMap?: Partial<ILayoutRectLevel>) => void;
  /** 基于元素内部逻辑计算占位空间，rect表示可用空间，返回元素的实际大小 */
  computeBoundsInRect: (rect: ILayoutRect) => ILayoutRect;
  /** 更新元素布局的起始点位置 */
  setLayoutStartPosition: (pos: Partial<IPoint>) => void;
  /** 更新绝对布局元素的位置信息 */
  absoluteLayoutInRect: (rect: IRect) => void;
  /** 元素内部布局信息更新 */
  updateLayoutAttribute: () => void;
}
```

在布局过程中，可以使用这些方法对布局元素进行操作。

> 注意，在对布局元素操作完成后，请调用 updateLayoutAttribute 方法，通知元素按照布局信息，更新元素的具体属性。

## 布局示例

下面是一个自定义布局的示例，它的效果是将 12 个饼图按照钟表时间的位置排列。

```javascript livedemo
const spec = {
  type: 'common',
  padding: 0,
  region: [],
  series: []
};

// 随机生成 12 组
for (let i = 0; i < 12; i++) {
  spec.region.push({ id: 'clock' + i });
  const series = {
    regionId: 'clock' + i,
    type: 'pie',
    valueField: 'value',
    categoryField: 'type',
    seriesField: 'type',
    label: {
      style: {
        visible: false
      }
    }
  };
  series.data = {
    id: 'data' + i,
    values: []
  };
  for (let d = 0; d < 4; d++) {
    series.data.values.push({ value: Math.random() * 100, type: 'type' + d });
  }
  spec.series.push(series);
}

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  layout: (chart, item, chartLayoutRect, chartViewBox) => {
    /**
     * chart 是图表对象
     * item 是参与布局的图表模块
     * chartLayoutRect 是图表减去padding后的可用布局空间
     * chartViewBox 是图表在画布中的位置，包含图表的padding。
     */
    const radius = Math.min(chartLayoutRect.width / 2, chartLayoutRect.height / 2);
    const center = { x: chartLayoutRect.width / 2, y: chartLayoutRect.height / 2 };
    const regionSize = radius * 0.2;
    const regionPosRadius = radius - regionSize * 0.5 * 1.415;
    // 使用布局元素的属性和提供的方法完成布局
    item.forEach((i, index) => {
      const angle = (index / 12) * Math.PI * 2;
      // 请在布局完成后务必调用
      i.setLayoutStartPosition({
        x: center.x + Math.sin(angle) * regionPosRadius - regionSize * 0.5,
        y: center.y + Math.cos(angle) * regionPosRadius - regionSize * 0.5
      });
      i.setLayoutRect({ width: regionSize, height: regionSize });
      i.updateLayoutAttribute && i.updateLayoutAttribute();
    });
  }
});
vchart.renderSync();
```
