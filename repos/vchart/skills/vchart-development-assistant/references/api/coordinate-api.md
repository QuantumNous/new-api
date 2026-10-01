# 坐标转换 API

## 概述

坐标转换 API 用于在数据值和画布坐标之间进行转换，常用于自定义标注、点击位置转换等场景。

---

## API 列表

### convertDatumToPosition

**将数据转换为坐标位置**

```typescript
convertDatumToPosition(
  datum: Datum,
  dataLinkInfo?: DataLinkSeries,
  isRelativeToCanvas?: boolean,
  checkInViewData?: boolean
): IPoint | null;
```

**参数**：
- `datum`: 数据对象
- `dataLinkInfo`: 关联的系列信息（seriesId 或 seriesIndex），默认 { seriesIndex: 0 }
- `isRelativeToCanvas`: 是否相对画布坐标，默认 false
- `checkInViewData`: 是否检查数据是否在视图中

**返回值**：坐标点 `{ x: number, y: number }` 或 null

**使用示例**：

```javascript
// 获取数据点在图表中的位置
const position = vchart.convertDatumToPosition({
  category: 'A',
  value: 20
});
console.log(position); // { x: 100, y: 200 }
```

---

### convertValueToPosition

**将数值转换为坐标位置**

```typescript
// 单值模式 - 用于轴转换
convertValueToPosition(
  value: StringOrNumber,
  dataLinkInfo: DataLinkAxis,
  isRelativeToCanvas?: boolean
): number | null;

// 双值模式 - 用于坐标系转换
convertValueToPosition(
  value: [StringOrNumber, StringOrNumber],
  dataLinkInfo: DataLinkSeries,
  isRelativeToCanvas?: boolean
): IPoint | null;
```

**参数**：
- `value`: 数值或数值对
- `dataLinkInfo`: 关联的轴或系列信息
- `isRelativeToCanvas`: 是否相对画布坐标

**使用示例**：

```javascript
// 将 X 轴值转换为坐标
const x = vchart.convertValueToPosition('A', { axisIndex: 0 });

// 将 Y 轴值转换为坐标
const y = vchart.convertValueToPosition(50, { axisIndex: 1 });

// 将坐标点值转换为位置
const point = vchart.convertValueToPosition(['A', 50], { seriesIndex: 0 });
```

---

## 类型定义

### DataLinkSeries

```typescript
type DataLinkSeries = {
  seriesId?: StringOrNumber;
  seriesIndex?: number;
};
```

### DataLinkAxis

```typescript
type DataLinkAxis = {
  axisId?: StringOrNumber;
  axisIndex?: number;
};
```

---

## 使用场景

### 场景 1: 在数据点位置添加自定义标注

```javascript
// 获取数据点位置并添加自定义元素
const data = { category: 'A', value: 30 };
const position = vchart.convertDatumToPosition(data, { seriesIndex: 0 }, true);

if (position) {
  // 创建自定义标注元素
  const marker = document.createElement('div');
  marker.className = 'custom-marker';
  marker.style.left = `${position.x}px`;
  marker.style.top = `${position.y}px`;
  container.appendChild(marker);
}
```

### 场景 2: 点击位置转换为数据值

```javascript
vchart.on('click', (params) => {
  const { x, y } = params.event;

  // 根据点击位置获取数据
  // 需要反向计算（根据具体需求实现）
});
```

### 场景 3: 多图表联动定位

```javascript
// 图表1点击时，在图表2对应位置显示标记
chart1.on('click', { level: 'mark' }, (params) => {
  if (params.datum) {
    // 获取图表1中的位置
    const pos1 = chart1.convertDatumToPosition(params.datum, {}, true);

    // 获取图表2中的对应数据位置
    const pos2 = chart2.convertDatumToPosition(params.datum, {}, true);

    // 在两个图表中显示联动标记
    showLinkMarker(pos1, pos2);
  }
});
```

### 场景 4: 绘制自定义连线

```javascript
// 连接两个数据点
function drawConnection(datum1, datum2) {
  const pos1 = vchart.convertDatumToPosition(datum1, {}, true);
  const pos2 = vchart.convertDatumToPosition(datum2, {}, true);

  if (pos1 && pos2) {
    const canvas = vchart.getCanvas();
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos1.x, pos1.y);
    ctx.lineTo(pos2.x, pos2.y);
    ctx.stroke();
  }
}
```

---

## 注意事项

### 1. 坐标系类型

不同图表类型的坐标系不同：
- **直角坐标系**（柱状图、折线图等）：返回 { x, y }
- **极坐标系**（饼图、雷达图等）：返回极坐标位置
- **地理坐标系**（地图）：返回投影后的坐标

### 2. 数据匹配

传入的 datum 需要包含足够的字段来匹配数据：

```javascript
// ❌ 可能失败 - 字段不完整
vchart.convertDatumToPosition({ category: 'A' });

// ✅ 推荐 - 包含完整字段
vchart.convertDatumToPosition({ category: 'A', value: 20, group: 'X' });
```

### 3. 渲染时机

必须在图表渲染完成后调用：

```javascript
// ❌ 错误 - 渲染前调用
const vchart = new VChart(spec, { dom });
const pos = vchart.convertDatumToPosition(data); // null

// ✅ 正确 - 渲染后调用
await vchart.renderAsync();
const pos = vchart.convertDatumToPosition(data); // 正确
```

---

## 完整示例

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
  <style>
    .marker {
      position: absolute;
      width: 20px;
      height: 20px;
      background: red;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="container" style="position: relative; width: 600px;">
    <div id="chart" style="width: 600px; height: 400px;"></div>
  </div>

  <div style="margin-top: 10px;">
    <button onclick="addMarker('A', 30)">标记 A</button>
    <button onclick="addMarker('B', 45)">标记 B</button>
    <button onclick="clearMarkers()">清除标记</button>
  </div>

  <script>
    const spec = {
      type: 'bar',
      data: [{
        id: 'data',
        values: [
          { category: 'A', value: 30 },
          { category: 'B', value: 45 },
          { category: 'C', value: 25 }
        ]
      }],
      xField: 'category',
      yField: 'value'
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    const container = document.getElementById('container');
    const markers = [];

    function addMarker(category, value) {
      const position = vchart.convertDatumToPosition(
        { category, value },
        { seriesIndex: 0 },
        true
      );

      if (position) {
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.left = `${position.x}px`;
        marker.style.top = `${position.y}px`;
        container.appendChild(marker);
        markers.push(marker);
      }
    }

    function clearMarkers() {
      markers.forEach(m => m.remove());
      markers.length = 0;
    }
  </script>
</body>
</html>
```
