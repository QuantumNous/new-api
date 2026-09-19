# 数据操作 API

## 概述

数据操作 API 用于动态更新图表数据，支持同步和异步两种模式。

---

## API 列表

### updateData

**异步更新指定数据集**

```typescript
updateData(id: StringOrNumber, data: Datum[] | string, options?: IParserOptions): Promise<IVChart>
```

**参数**：
- `id`: 数据集 ID（spec 中定义的 data.id）
- `data`: 新数据数组或数据 URL
- `options`: 数据解析选项（可选）

**返回值**：Promise<IVChart>

**使用示例**：

```javascript
const vchart = new VChart(spec, { dom: 'container' });
await vchart.renderAsync();

// 更新数据
await vchart.updateData('myData', [
  { category: 'A', value: 20 },
  { category: 'B', value: 30 },
  { category: 'C', value: 25 }
]);
```

**适用场景**：
- ✅ 单个数据集更新
- ✅ 从 API 获取数据后更新
- ✅ 数据筛选后更新

---

### updateDataSync

**同步更新指定数据集**

```typescript
updateDataSync(id: StringOrNumber, data: Datum[], options?: IParserOptions): IVChart
```

**参数**：
- `id`: 数据集 ID
- `data`: 新数据数组
- `options`: 数据解析选项（可选）

**返回值**：IVChart（支持链式调用）

**使用示例**：

```javascript
// 同步更新数据
vchart.updateDataSync('myData', newData);

// 链式调用
vchart
  .updateDataSync('data1', data1)
  .updateDataSync('data2', data2);
```

**适用场景**：
- ✅ 需要立即获取更新结果
- ✅ 实时数据刷新（避免闪烁）
- ✅ 调试场景

---

### updateDataInBatches

**批量更新多个数据集**

```typescript
updateDataInBatches(list: { id: string; data: Datum[]; options?: IParserOptions }[]): Promise<IVChart>
```

**参数**：
- `list`: 数据更新列表，每个元素包含 id、data、options

**返回值**：Promise<IVChart>

**使用示例**：

```javascript
// 批量更新多个数据集
await vchart.updateDataInBatches([
  { id: 'sales', data: salesData },
  { id: 'profit', data: profitData },
  { id: 'cost', data: costData }
]);
```

**适用场景**：
- ✅ 多个数据集同时更新
- ✅ 减少渲染次数，提升性能
- ✅ 组合图数据更新

---

### updateFullData

**异步更新完整数据对象**

```typescript
updateFullData(data: IDataValues | IDataValues[], reRender?: boolean): Promise<IVChart>
```

**参数**：
- `data`: 完整数据对象（包含 id、values 等）
- `reRender`: 是否重新渲染，默认 true

**返回值**：Promise<IVChart>

**使用示例**：

```javascript
// 更新完整数据对象
await vchart.updateFullData({
  id: 'myData',
  values: [
    { category: 'A', value: 20 },
    { category: 'B', value: 30 }
  ]
});

// 更新多个数据对象
await vchart.updateFullData([
  { id: 'data1', values: data1Values },
  { id: 'data2', values: data2Values }
]);
```

**适用场景**：
- ✅ 完整替换数据结构
- ✅ 数据格式变化较大
- ✅ 需要更新数据的元信息

---

### updateFullDataSync

**同步更新完整数据对象**

```typescript
updateFullDataSync(data: IDataValues | IDataValues[], reRender?: boolean): IVChart
```

**参数**：
- `data`: 完整数据对象
- `reRender`: 是否重新渲染，默认 true

**返回值**：IVChart

**使用示例**：

```javascript
vchart.updateFullDataSync({
  id: 'myData',
  values: newData
});
```

---

## 使用场景

### 场景 1: 实时数据刷新

**需求**：每秒更新图表数据

```javascript
// WebSocket 实时数据
const ws = new WebSocket('wss://api.example.com/realtime');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  vchart.updateDataSync('realtimeData', data);
};
```

### 场景 2: 数据筛选

**需求**：根据用户选择筛选数据

```javascript
function filterData(category) {
  const filteredData = allData.filter(d => d.category === category);
  vchart.updateData('myData', filteredData);
}
```

### 场景 3: 组合图数据更新

**需求**：双 Y 轴图表，同时更新两个系列的数据

```javascript
// 批量更新多个数据集
async function updateComboChart(sales, profit) {
  await vchart.updateDataInBatches([
    { id: 'salesData', data: sales },
    { id: 'profitData', data: profit }
  ]);
}
```

### 场景 4: API 数据加载

**需求**：从后端 API 获取数据并更新

```javascript
async function loadDataFromAPI() {
  const response = await fetch('/api/chart-data');
  const data = await response.json();
  await vchart.updateData('chartData', data);
}
```

---

## 性能优化建议

### 1. 选择合适的更新方式

| 数据量 | 更新频率 | 推荐 API |
|--------|---------|---------|
| 小（< 100 条） | 低频 | `updateData` |
| 大（> 100 条） | 低频 | `updateData` + 数据预处理 |
| 小（< 100 条） | 高频 | `updateDataSync` |
| 大（> 100 条） | 高频 | `updateDataSync` + 增量更新 |

### 2. 批量更新优化

**❌ 不推荐**：多次单独更新
```javascript
await vchart.updateData('data1', data1);
await vchart.updateData('data2', data2);
await vchart.updateData('data3', data3);
// 渲染 3 次
```

**✅ 推荐**：批量更新
```javascript
await vchart.updateDataInBatches([
  { id: 'data1', data: data1 },
  { id: 'data2', data: data2 },
  { id: 'data3', data: data3 }
]);
// 只渲染 1 次
```

### 3. 数据预处理

在更新数据前进行预处理，减少 VChart 内部的数据处理时间：

```javascript
// 预先排序数据
const sortedData = data.sort((a, b) => b.value - a.value);
await vchart.updateData('myData', sortedData);
```

---

## 常见问题

### Q1: updateData 后图表不更新？

**原因**：数据 ID 不匹配或数据格式错误

**解决方案**：
```javascript
// 检查 spec 中的 data.id
const spec = {
  data: [{ id: 'myData', values: [...] }]  // 注意这个 id
};

// 更新时使用相同的 id
await vchart.updateData('myData', newData);
```

### Q2: 高频更新导致性能问题？

**解决方案**：
1. 使用 `updateDataSync` 减少异步开销
2. 实现数据节流/防抖
3. 使用增量更新（仅更新变化的数据）

```javascript
// 节流更新
let updateTimer;
function throttledUpdate(data) {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    vchart.updateDataSync('myData', data);
  }, 100);
}
```

### Q3: 如何判断数据更新完成？

**异步 API**：使用 await 或 Promise.then()
```javascript
await vchart.updateData('myData', newData);
console.log('数据更新完成');
```

**同步 API**：立即完成，无需等待
```javascript
vchart.updateDataSync('myData', newData);
console.log('数据已更新');
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
  <button onclick="updateData()">更新数据</button>

  <script>
    const spec = {
      type: 'bar',
      data: [{ id: 'myData', values: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 15 }
      ]}],
      xField: 'category',
      yField: 'value'
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    function updateData() {
      const newData = [
        { category: 'A', value: Math.random() * 30 },
        { category: 'B', value: Math.random() * 30 },
        { category: 'C', value: Math.random() * 30 }
      ];

      // 方式 1: 异步更新
      // vchart.updateData('myData', newData);

      // 方式 2: 同步更新
      vchart.updateDataSync('myData', newData);
    }
  </script>
</body>
</html>
```