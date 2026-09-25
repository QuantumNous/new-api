# 交互控制 API

## 概述

交互控制 API 用于手动触发或禁用图表的交互效果，包括 Tooltip、Crosshair、Dimension 等。

---

## API 列表

### showTooltip

**手动显示 Tooltip**

```typescript
showTooltip(datum: Datum, options: IShowTooltipOption): boolean;
```

**参数**：
- `datum`: 要显示 tooltip 的数据
- `options`: 显示选项

**返回值**：是否成功显示

**使用示例**：

```javascript
// 显示指定数据的 tooltip
vchart.showTooltip(
  { category: 'A', value: 20 },
  { position: { x: 100, y: 100 } }
);
```

---

### hideTooltip

**隐藏 Tooltip**

```typescript
hideTooltip(): boolean;
```

**返回值**：是否成功隐藏

**使用示例**：

```javascript
vchart.hideTooltip();
```

---

### setDimensionIndex

**手动触发 dimension 交互效果**

```typescript
setDimensionIndex(value: StringOrNumber, options?: DimensionIndexOption): void;
```

**参数**：
- `value`: 维度值
- `options`: 触发配置

**使用示例**：

```javascript
// 触发指定维度的交互效果
vchart.setDimensionIndex('A');  // 显示 'A' 类别的 crosshair 和 tooltip
```

---

### disableTooltip

**禁用/启用 Tooltip**

```typescript
disableTooltip(disabled: boolean): void;
```

**参数**：
- `disabled`: true 禁用，false 启用

**使用示例**：

```javascript
// 禁用 tooltip
vchart.disableTooltip(true);

// 重新启用
vchart.disableTooltip(false);
```

---

### disableCrossHair

**禁用/启用 Crosshair**

```typescript
disableCrossHair(disabled: boolean): void;
```

**参数**：
- `disabled`: true 禁用，false 启用

**使用示例**：

```javascript
vchart.disableCrossHair(true);
```

---

### disableDimensionHoverEvent

**禁用/启用 dimension hover 事件**

```typescript
disableDimensionHoverEvent(disabled?: boolean): void;
```

**参数**：
- `disabled`: true 禁用，false 启用

**使用示例**：

```javascript
vchart.disableDimensionHoverEvent(true);
```

---

## 使用场景

### 场景 1: 外部触发 Tooltip

```javascript
// 通过外部按钮显示 tooltip
function showTooltipForCategory(category) {
  const data = chartData.find(d => d.category === category);
  if (data) {
    const position = vchart.convertDatumToPosition(data);
    vchart.showTooltip(data, { position });
  }
}
```

### 场景 2: 联动 Crosshair

```javascript
// 两个图表联动 crosshair
chart1.on('pointermove', (params) => {
  if (params.value?.dimension) {
    chart2.setDimensionIndex(params.value.dimension);
  }
});

chart1.on('pointerout', () => {
  chart2.setDimensionIndex(null);
});
```

### 场景 3: 条件禁用交互

```javascript
// 数据加载时禁用交互
async function reloadData() {
  vchart.disableTooltip(true);
  vchart.disableCrossHair(true);

  await vchart.updateData('data', newData);

  vchart.disableTooltip(false);
  vchart.disableCrossHair(false);
}
```

### 场景 4: 自定义 Tooltip 触发

```javascript
// 点击外部元素显示 tooltip
document.getElementById('info-panel').addEventListener('mouseenter', (e) => {
  const category = e.target.dataset.category;
  const data = chartData.find(d => d.category === category);
  vchart.showTooltip(data, {});
});

document.getElementById('info-panel').addEventListener('mouseleave', () => {
  vchart.hideTooltip();
});
```

---

## TooltipHandler 自定义

### setTooltipHandler

**设置自定义 Tooltip 处理器**

```typescript
setTooltipHandler(tooltipHandler: ITooltipHandler): void;
```

**使用示例**：

```javascript
const customHandler = {
  showTooltip: (activeTooltip, params) => {
    // 自定义显示逻辑
    console.log('显示 tooltip', activeTooltip);
    return true;
  },
  hideTooltip: () => {
    // 自定义隐藏逻辑
    console.log('隐藏 tooltip');
    return true;
  },
  release: () => {
    // 清理资源
  }
};

vchart.setTooltipHandler(customHandler);
```

### getTooltipHandler

**获取当前 Tooltip 处理器**

```typescript
getTooltipHandler(): ITooltipHandler | undefined;
```

---

## 完整示例

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
</head>
<body>
  <div id="chart" style="width: 600px; height: 400px;"></div>

  <div style="margin-top: 10px;">
    <button onclick="showTooltipA()">显示 A 的 Tooltip</button>
    <button onclick="triggerDimension('B')">触发 B 的 Dimension</button>
    <button onclick="hideAll()">隐藏所有</button>
    <button onclick="toggleTooltip()">切换 Tooltip</button>
  </div>

  <script>
    const spec = {
      type: 'bar',
      data: [{
        id: 'data',
        values: [
          { category: 'A', value: 20 },
          { category: 'B', value: 35 },
          { category: 'C', value: 25 }
        ]
      }],
      xField: 'category',
      yField: 'value',
      tooltip: { visible: true },
      crosshair: { xField: { visible: true } }
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    function showTooltipA() {
      const data = { category: 'A', value: 20 };
      vchart.showTooltip(data, {});
    }

    function triggerDimension(cat) {
      vchart.setDimensionIndex(cat);
    }

    function hideAll() {
      vchart.hideTooltip();
      vchart.setDimensionIndex(null);
    }

    let tooltipEnabled = true;
    function toggleTooltip() {
      tooltipEnabled = !tooltipEnabled;
      vchart.disableTooltip(!tooltipEnabled);
    }
  </script>
</body>
</html>
```
