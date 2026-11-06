# 图例操作 API

## 概述

图例操作 API 用于获取图例数据和设置图例选中状态。

---

## API 列表

### getLegendDataById

**根据 ID 获取图例数据**

```typescript
getLegendDataById(id: string): Datum[];
```

**参数**：
- `id`: 图例组件 ID

**返回值**：图例数据数组

---

### getLegendDataByIndex

**根据索引获取图例数据**

```typescript
getLegendDataByIndex(index?: number): Datum[];
```

**参数**：
- `index`: 图例索引，默认 0

---

### getLegendSelectedDataById

**根据 ID 获取图例选中项**

```typescript
getLegendSelectedDataById(id: string): StringOrNumber[];
```

**返回值**：选中的图例项值数组

---

### getLegendSelectedDataByIndex

**根据索引获取图例选中项**

```typescript
getLegendSelectedDataByIndex(index?: number): StringOrNumber[];
```

---

### setLegendSelectedDataById

**根据 ID 设置图例选中项**

```typescript
setLegendSelectedDataById(id: string, selectedData: StringOrNumber[]): void;
```

**参数**：
- `id`: 图例组件 ID
- `selectedData`: 要选中的图例项值数组

---

### setLegendSelectedDataByIndex

**根据索引设置图例选中项**

```typescript
setLegendSelectedDataByIndex(index: number, selectedData: StringOrNumber[]): void;
```

---

## 使用场景

### 场景 1: 获取当前图例选中状态

```javascript
const selected = vchart.getLegendSelectedDataByIndex(0);
console.log('当前选中:', selected); // ['A', 'B']
```

### 场景 2: 程序控制图例选中

```javascript
// 只显示指定类别
vchart.setLegendSelectedDataByIndex(0, ['A', 'B']);

// 全选
const allData = vchart.getLegendDataByIndex(0);
const allValues = allData.map(d => d.value);
vchart.setLegendSelectedDataByIndex(0, allValues);
```

### 场景 3: 图例状态保存与恢复

```javascript
// 保存图例状态
function saveLegendState() {
  return vchart.getLegendSelectedDataByIndex(0);
}

// 恢复图例状态
function restoreLegendState(selected) {
  vchart.setLegendSelectedDataByIndex(0, selected);
}
```

### 场景 4: 多图表图例联动

```javascript
// 图表1图例变化时，同步到图表2
chart1.on('legendItemClick', (params) => {
  chart2.setLegendSelectedDataByIndex(0, params.value);
});
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
    <button onclick="selectAll()">全选</button>
    <button onclick="selectNone()">全不选</button>
    <button onclick="showSelected()">显示选中项</button>
  </div>

  <script>
    const spec = {
      type: 'bar',
      data: [{
        id: 'data',
        values: [
          { category: 'A', type: 'X', value: 20 },
          { category: 'B', type: 'X', value: 30 },
          { category: 'A', type: 'Y', value: 25 },
          { category: 'B', type: 'Y', value: 35 }
        ]
      }],
      xField: 'category',
      yField: 'value',
      seriesField: 'type',
      legends: { visible: true }
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    function selectAll() {
      const allData = vchart.getLegendDataByIndex(0);
      const allTypes = allData.map(d => d.type);
      vchart.setLegendSelectedDataByIndex(0, allTypes);
    }

    function selectNone() {
      vchart.setLegendSelectedDataByIndex(0, []);
    }

    function showSelected() {
      const selected = vchart.getLegendSelectedDataByIndex(0);
      alert('当前选中: ' + selected.join(', '));
    }
  </script>
</body>
</html>
```
