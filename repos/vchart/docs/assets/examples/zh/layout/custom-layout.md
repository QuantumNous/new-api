---
category: examples
group: layout
title: 自定义布局
order: 37-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/7b82fb013e7c6319c065b3d01.png
option: commonChart#layout
---

# 自定义布局

在图表中，除了内置的布局逻辑，用户也可以通过自定义布局接口，实现完全的自定义布局。

## 关键配置

在图元上配置纹理相关的属性即可：

- `layout` 在初始化参数的次配置中配置函数，函数的类型如下

```ts
export type LayoutCallBack = (
  chart: IChart, // 图表对象
  item: ILayoutItem[], // 参与布局的图表模块
  chartLayoutRect: IRect, // 图表减去padding后的可用布局空间
  chartViewBox: IBoundsLike // 图表在画布中的位置，包含图表的padding。
) => void;
```

## 代码演示

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

## 相关教程

[布局](link)
