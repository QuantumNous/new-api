# 布局案例：自定义布局

## 案例介绍

在某些场景下，用户会期望完全按照自己的意愿对图表元素进行布局。下面是一个自定义布局的例子，将 12 个饼图按照钟表时间的位置排列。

## 案例配置

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
      i.model.updateLayoutAttribute();
    });
  }
});
vchart.renderSync();
```
