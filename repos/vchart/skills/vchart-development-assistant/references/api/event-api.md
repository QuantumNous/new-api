# 事件监听 API

## 概述

VChart 提供了完整的事件监听机制，支持基础 DOM 事件、组件事件、图元事件和生命周期事件。

---

## API 列表

### on

**注册事件监听器**

```typescript
on(event: string, callback: (params: EventParams) => void): void;
on(event: string, query: EventQuery, callback: (params: EventParams) => void): void;
```

**参数**：
- `event`: 事件名称
- `query`: 事件过滤条件（可选）
- `callback`: 事件回调函数

**使用示例**：

```javascript
// 基础事件监听
vchart.on('click', (params) => {
  console.log('点击了图表', params);
});

// 带过滤条件的事件监听
vchart.on('click', { level: 'mark', type: 'bar' }, (params) => {
  console.log('点击了柱子', params.datum);
});
```

---

### off

**移除事件监听器**

```typescript
off(event: string, callback?: (params: EventParams) => void): void;
```

**参数**：
- `event`: 事件名称
- `callback`: 要移除的回调函数（可选，不传则移除该事件所有监听）

**使用示例**：

```javascript
const handler = (params) => console.log(params);

// 添加监听
vchart.on('click', handler);

// 移除特定监听
vchart.off('click', handler);

// 移除所有 click 监听
vchart.off('click');
```

---

## 事件参数结构

所有事件回调都接收统一的事件参数：

```typescript
type EventParams = {
  /** 原始事件对象 */
  event: SuperEvent;
  /** 事件携带的数据 */
  value?: any;
  /** 事件源的 mark */
  mark?: IMark;
  /** 事件源的 model */
  model?: IModel;
  /** 事件源的 chart */
  chart?: IChart;
  /** 拾取到的图元数据 */
  datum?: Datum;
  /** 拾取到的图形节点 */
  node?: INode;
};
```

---

## 事件分类

### 1. 基础 DOM 事件

#### 指针事件
```javascript
vchart.on('pointerdown', handler);
vchart.on('pointerup', handler);
vchart.on('pointermove', handler);
vchart.on('pointerover', handler);
vchart.on('pointerout', handler);
vchart.on('pointertap', handler);
```

#### 鼠标事件
```javascript
vchart.on('click', handler);
vchart.on('dblclick', handler);
vchart.on('mousedown', handler);
vchart.on('mouseup', handler);
vchart.on('mousemove', handler);
vchart.on('mouseover', handler);
vchart.on('mouseout', handler);
vchart.on('wheel', handler);
```

#### 触摸事件
```javascript
vchart.on('touchstart', handler);
vchart.on('touchend', handler);
vchart.on('touchmove', handler);
vchart.on('tap', handler);
```

#### 拖拽事件
```javascript
vchart.on('dragstart', handler);
vchart.on('drag', handler);
vchart.on('dragend', handler);
vchart.on('drop', handler);
```

### 2. 组件事件

#### 图例事件
```javascript
// 图例点击
vchart.on('legendItemClick', (params) => {
  console.log('选中的图例项', params.value);
});

// 图例 hover
vchart.on('legendItemHover', (params) => {
  console.log('hover 的图例项', params.value);
});
```

#### DataZoom 事件
```javascript
vchart.on('dataZoomChange', (params) => {
  console.log('缩放范围', params.value.start, params.value.end);
});
```

#### Brush 框选事件
```javascript
vchart.on('brushEnd', (params) => {
  console.log('框选的数据', params.value.inBrushData);
});
```

### 3. 生命周期事件

```javascript
// 图表初始化完成
vchart.on('initialized', (params) => {
  console.log('图表初始化完成');
});

// 渲染完成（只触发一次）
vchart.on('rendered', (params) => {
  console.log('图表首次渲染完成');
});

// 每次渲染完成
vchart.on('renderFinished', (params) => {
  console.log('图表渲染完成');
});

// 动画结束
vchart.on('animationFinished', (params) => {
  console.log('动画播放完成');
});

// 尺寸变化
vchart.on('afterResize', (params) => {
  console.log('图表尺寸变化');
});
```

---

## 事件过滤

### 过滤规则

| 过滤方式 | 说明 | 示例 |
|---------|------|------|
| `source` | 按事件源过滤 | `{ source: 'window' }` |
| `level` | 按冒泡层级过滤 | `{ level: 'mark' }` |
| `type` | 按组件/mark 类型过滤 | `{ type: 'axis' }` |
| `nodeName` | 按图形节点名过滤 | `{ nodeName: 'axis-label' }` |
| `markName` | 按 mark 名称过滤 | `{ markName: 'bar' }` |
| `id` | 按 spec 中的 id 过滤 | `{ id: 'axis-left' }` |
| `filter` | 自定义过滤函数 | `{ filter: (e) => e.model.id === 1 }` |

### 常用过滤示例

```javascript
// 监听特定系列的点击
vchart.on('click', { seriesId: 'sales' }, (params) => {
  console.log('点击了 sales 系列');
});

// 监听坐标轴点击
vchart.on('click', { level: 'model', type: 'axis' }, (params) => {
  console.log('点击了坐标轴');
});

// 监听柱子点击
vchart.on('click', { level: 'mark', type: 'bar' }, (params) => {
  console.log('点击了柱子', params.datum);
});

// 监听标签点击（需要先开启标签交互）
// spec: { label: { interactive: true } }
vchart.on('click', { nodeName: 'label' }, (params) => {
  console.log('点击了标签');
});
```

---

## 使用场景

### 场景 1: 点击图元获取数据

```javascript
vchart.on('click', { level: 'mark' }, (params) => {
  if (params.datum) {
    console.log('点击的数据:', params.datum);
    // 跳转到详情页
    window.location.href = `/detail?id=${params.datum.id}`;
  }
});
```

### 场景 2: 实现 Tooltip 外部控制

```javascript
// 鼠标悬停时更新外部信息面板
vchart.on('pointermove', { level: 'mark' }, (params) => {
  if (params.datum) {
    updateInfoPanel(params.datum);
  }
});

vchart.on('pointerout', () => {
  hideInfoPanel();
});
```

### 场景 3: 图例联动

```javascript
// 监听图例点击，联动其他图表
vchart.on('legendItemClick', (params) => {
  const selectedItems = params.value;
  // 更新其他图表的显示
  otherChart.updateData('mainData', filterByCategories(selectedItems));
});
```

### 场景 4: 数据下钻

```javascript
vchart.on('dblclick', { level: 'mark' }, async (params) => {
  if (params.datum) {
    // 双击下钻
    const drillData = await fetchDetailData(params.datum.category);
    vchart.updateData('mainData', drillData);
  }
});
```

### 场景 5: 框选数据导出

```javascript
vchart.on('brushEnd', (params) => {
  const selectedData = params.value.inBrushData;
  // 导出选中数据
  exportToExcel(selectedData);
});
```

---

## 性能优化

### 节流与防抖

事件过滤配置支持内置的节流和防抖：

```javascript
// 节流（每 200ms 最多触发一次）
vchart.on('pointermove', { throttle: 200 }, handler);

// 防抖（停止 200ms 后触发）
vchart.on('pointermove', { debounce: 200 }, handler);
```

### 事件销毁

组件销毁时记得移除事件监听：

```javascript
// 保存监听器引用
const handlers = {
  click: handleClick,
  hover: handleHover
};

// 添加监听
Object.entries(handlers).forEach(([event, handler]) => {
  vchart.on(event, handler);
});

// 销毁时移除
function destroy() {
  Object.entries(handlers).forEach(([event, handler]) => {
    vchart.off(event, handler);
  });
  vchart.release();
}
```

---

## 常见问题

### Q1: 点击图元没有反应？

**检查**：
1. 是否正确使用了过滤条件
2. 图元是否可交互（某些组件默认关闭交互）

```javascript
// 确保图元可交互
vchart.on('click', { level: 'mark' }, handler);
```

### Q2: 如何获取点击的坐标？

```javascript
vchart.on('click', (params) => {
  // 原始事件坐标
  const clientX = params.event.client.x;
  const clientY = params.event.client.y;

  // 图表内坐标
  const canvasX = params.event.offsetX;
  const canvasY = params.event.offsetY;
});
```

### Q3: 如何阻止事件冒泡？

```javascript
vchart.on('click', (params) => {
  params.event.stopPropagation();
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
  <div id="info" style="margin-top: 10px; padding: 10px; background: #f0f0f0;"></div>

  <script>
    const spec = {
      type: 'bar',
      data: [{
        id: 'data',
        values: [
          { category: 'A', value: 20 },
          { category: 'B', value: 30 },
          { category: 'C', value: 25 }
        ]
      }],
      xField: 'category',
      yField: 'value'
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    // 点击事件
    vchart.on('click', { level: 'mark', type: 'bar' }, (params) => {
      document.getElementById('info').innerHTML =
        `点击了: ${params.datum.category}, 值: ${params.datum.value}`;
    });

    // hover 事件
    vchart.on('pointerover', { level: 'mark' }, (params) => {
      if (params.datum) {
        document.getElementById('info').innerHTML =
          `悬停: ${params.datum.category}`;
      }
    });

    // 渲染完成事件
    vchart.on('renderFinished', () => {
      console.log('图表渲染完成');
    });
  </script>
</body>
</html>
```
