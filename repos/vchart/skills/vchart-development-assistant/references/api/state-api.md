# 状态管理 API

## 概述

状态管理 API 用于控制图元的高亮、选中等交互状态，支持自定义状态配置。

---

## API 列表

### setHovered

**设置图元 hover 状态**

```typescript
setHovered(
  datum: MaybeArray<Datum> | null,
  filter?: (series: ISeries, mark: IMark) => boolean,
  region?: IRegionQuerier
): void;
```

**参数**：
- `datum`: 要 hover 的数据（单条或数组），传 null 清除
- `filter`: 过滤函数，指定哪些 series/mark 受影响
- `region`: 区域过滤

**使用示例**：

```javascript
// 设置单个数据 hover
vchart.setHovered({ category: 'A', value: 20 });

// 设置多个数据 hover
vchart.setHovered([
  { category: 'A', value: 20 },
  { category: 'B', value: 30 }
]);

// 清除 hover 状态
vchart.setHovered(null);
```

---

### setSelected

**设置图元选中状态**

```typescript
setSelected(
  datum: MaybeArray<any> | null,
  filter?: (series: ISeries, mark: IMark) => boolean,
  region?: IRegionQuerier
): void;
```

**参数**：
- `datum`: 要选中的数据，传 null 清除
- `filter`: 过滤函数
- `region`: 区域过滤

**使用示例**：

```javascript
// 选中单个数据
vchart.setSelected({ category: 'A', value: 20 });

// 选中多个数据
vchart.setSelected([
  { category: 'A', value: 20 },
  { category: 'B', value: 30 }
]);

// 清除选中状态
vchart.setSelected(null);
```

---

### clearHovered

**清除所有 hover 状态**

```typescript
clearHovered(): void;
```

**使用示例**：

```javascript
vchart.clearHovered();
```

---

### clearSelected

**清除所有选中状态**

```typescript
clearSelected(): void;
```

**使用示例**：

```javascript
vchart.clearSelected();
```

---

### clearState

**清除指定状态**

```typescript
clearState(state: string): void;
```

**参数**：
- `state`: 状态名称

**使用示例**：

```javascript
// 清除自定义状态
vchart.clearState('customState');
```

---

### updateState

**更新自定义状态配置**

```typescript
updateState(
  state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
  filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean
): void;
```

**参数**：
- `state`: 状态配置对象
- `filter`: 过滤函数

**使用示例**：

```javascript
// 配置自定义状态
vchart.updateState({
  highlight: {
    filter: (datum) => datum.value > 50
  }
});
```

---

## 使用场景

### 场景 1: 外部控制图元高亮

```javascript
// 根据外部表格 hover 高亮图表
table.on('rowHover', (row) => {
  vchart.setHovered({ category: row.category });
});

table.on('rowLeave', () => {
  vchart.clearHovered();
});
```

### 场景 2: 多图表联动高亮

```javascript
// 图表1 hover 联动图表2
chart1.on('pointerover', { level: 'mark' }, (params) => {
  if (params.datum) {
    chart2.setHovered(params.datum);
  }
});

chart1.on('pointerout', () => {
  chart2.clearHovered();
});
```

### 场景 3: 点击选中并保持状态

```javascript
let selectedData = null;

vchart.on('click', { level: 'mark' }, (params) => {
  if (params.datum) {
    // 切换选中状态
    if (selectedData === params.datum) {
      vchart.clearSelected();
      selectedData = null;
    } else {
      vchart.setSelected(params.datum);
      selectedData = params.datum;
    }
  }
});
```

### 场景 4: 条件筛选高亮

```javascript
// 高亮数值大于 50 的数据
const highValues = data.filter(d => d.value > 50);
vchart.setHovered(highValues);

// 或使用 filter 函数
vchart.setHovered(
  data,
  (series, mark) => mark.name === 'bar'
);
```

---

## 状态样式配置

### Spec 中配置状态样式

```javascript
const spec = {
  type: 'bar',
  data: [{ id: 'data', values: [...] }],
  xField: 'category',
  yField: 'value',

  // hover 状态样式
  hover: {
    enable: true,
    style: {
      fillOpacity: 0.8,
      stroke: '#000',
      lineWidth: 2
    }
  },

  // 选中状态样式
  select: {
    enable: true,
    style: {
      fill: '#ff6b6b',
      stroke: '#333',
      lineWidth: 3
    }
  },

  // 自定义状态
  state: {
    highlight: {
      style: {
        fill: '#ffd43b'
      }
    }
  }
};
```

### 通过 updateState 动态配置

```javascript
vchart.updateState({
  highlight: {
    filter: (datum) => datum.value > 100
  },
  dim: {
    filter: (datum) => datum.value < 20
  }
});
```

---

## 注意事项

### 1. 数据匹配

`setHovered`/`setSelected` 中的 datum 需要与原始数据结构匹配：

```javascript
// 原始数据
const data = [
  { category: 'A', value: 20, year: 2024 }
];

// ✅ 正确 - 匹配数据结构
vchart.setHovered({ category: 'A', value: 20, year: 2024 });

// ❌ 可能不匹配 - 字段不完整
vchart.setHovered({ category: 'A' });
```

### 2. 状态优先级

当同时设置多个状态时，优先级为：
1. selected
2. hovered
3. 自定义状态

### 3. 性能考虑

频繁设置状态会影响性能，建议：

```javascript
// ❌ 不推荐 - 频繁调用
data.forEach(d => vchart.setHovered(d));

// ✅ 推荐 - 批量设置
vchart.setHovered(data);
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
  <button onclick="highlightMax()">高亮最大值</button>
  <button onclick="selectCategory('A')">选中 A</button>
  <button onclick="clearAll()">清除状态</button>

  <script>
    const spec = {
      type: 'bar',
      data: [{
        id: 'data',
        values: [
          { category: 'A', value: 20 },
          { category: 'B', value: 35 },
          { category: 'C', value: 25 },
          { category: 'D', value: 45 }
        ]
      }],
      xField: 'category',
      yField: 'value',
      hover: { enable: true },
      select: { enable: true }
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    function highlightMax() {
      const data = spec.data[0].values;
      const max = data.reduce((a, b) => a.value > b.value ? a : b);
      vchart.setHovered(max);
    }

    function selectCategory(cat) {
      const data = spec.data[0].values.find(d => d.category === cat);
      vchart.setSelected(data);
    }

    function clearAll() {
      vchart.clearHovered();
      vchart.clearSelected();
    }
  </script>
</body>
</html>
```
