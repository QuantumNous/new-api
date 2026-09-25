# 布局与尺寸 API

## 概述

布局与尺寸 API 用于控制图表的尺寸和布局。

---

## API 列表

### resize

**调整图表尺寸**

```typescript
resize(width: number, height: number): Promise<IVChart>;
```

**参数**：
- `width`: 新宽度
- `height`: 新高度

**使用示例**：

```javascript
await vchart.resize(800, 600);
```

---

### updateViewBox

**更新绘制区域**

```typescript
updateViewBox(viewBox: IBoundsLike, reRender?: boolean): IVChart;
```

**参数**：
- `viewBox`: 绘制区域 { x1, y1, x2, y2 }
- `reRender`: 是否重新渲染，默认 true

---

### setLayout

**设置自定义布局**

```typescript
setLayout(layout: LayoutCallBack): void;
```

---

### reLayout

**强制重新布局**

```typescript
reLayout(): void;
```

---

### getCurrentSize

**获取当前容器尺寸**

```typescript
getCurrentSize(): IContainerSize;
```

**返回值**：`{ width: number, height: number }`

---

## 使用场景

### 场景 1: 响应式布局

```javascript
// 监听容器尺寸变化
const resizeObserver = new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  vchart.resize(width, height);
});

resizeObserver.observe(document.getElementById('chart-container'));
```

### 场景 2: 窗口 resize

```javascript
window.addEventListener('resize', () => {
  const container = document.getElementById('chart');
  vchart.resize(container.clientWidth, container.clientHeight);
});
```

### 场景 3: 全屏切换

```javascript
function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    vchart.resize(600, 400);
  } else {
    document.getElementById('chart').requestFullscreen();
    vchart.resize(window.innerWidth, window.innerHeight);
  }
}
```

---

## 完整示例

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
  <style>
    #chart-container { resize: both; overflow: hidden; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div id="chart-container" style="width: 600px; height: 400px;">
    <div id="chart" style="width: 100%; height: 100%;"></div>
  </div>

  <div style="margin-top: 10px;">
    <button onclick="resizeChart(800, 400)">宽屏</button>
    <button onclick="resizeChart(400, 400)">正方形</button>
    <button onclick="fitContainer()">适应容器</button>
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
      yField: 'value'
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    function resizeChart(w, h) {
      const container = document.getElementById('chart-container');
      container.style.width = w + 'px';
      container.style.height = h + 'px';
      vchart.resize(w, h);
    }

    function fitContainer() {
      const container = document.getElementById('chart-container');
      vchart.resize(container.clientWidth, container.clientHeight);
    }

    // 响应容器 resize
    new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      vchart.resize(width, height);
    }).observe(document.getElementById('chart-container'));
  </script>
</body>
</html>
```
