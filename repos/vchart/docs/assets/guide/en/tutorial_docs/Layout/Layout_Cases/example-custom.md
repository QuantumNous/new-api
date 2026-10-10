# Layout Example: Custom Layout

## Example Introduction

In some scenarios, users may want to arrange chart elements according to their own preferences. Here is an example of custom layout, arranging 12 pie charts in the order of clock time positions.

## Example Configuration

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
     * chart: 图表对象
     * item: 参与布局的图表模块
     * chartLayoutRect: 图表减去padding后的可用布局空间
     * chartViewBox: 图表在画布中的位置，包含图表的padding。
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
      i.updateLayoutAttribute();
    });
  }
});
vchart.renderSync();
```
