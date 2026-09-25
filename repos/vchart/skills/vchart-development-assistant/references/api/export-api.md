# 导出功能 API

## 概述

导出功能 API 用于将图表导出为图片或其他格式。

---

## API 列表

### exportImg

**导出图片文件（仅浏览器端）**

```typescript
exportImg(name?: string): Promise<void>;
```

**参数**：
- `name`: 保存的文件名（可选）

**使用示例**：

```javascript
// 导出图片（会触发浏览器下载）
await vchart.exportImg('my-chart');
```

---

### getDataURL

**获取图片 Data URL**

```typescript
getDataURL(): Promise<string>;
```

**返回值**：Promise<string> - base64 格式的图片数据

**使用示例**：

```javascript
const dataURL = await vchart.getDataURL();
console.log(dataURL); // data:image/png;base64,...

// 用于 img 标签
document.getElementById('preview').src = dataURL;
```

---

### exportCanvas

**导出 Canvas 元素**

```typescript
exportCanvas(): HTMLCanvasElement | undefined;
```

**返回值**：Canvas 元素或 undefined

**使用示例**：

```javascript
const canvas = vchart.exportCanvas();
if (canvas) {
  // 进行自定义处理
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, 10, 10);
}
```

---

### getImageBuffer

**获取图片 Buffer（仅 Node.js 环境）**

```typescript
getImageBuffer(): void;
```

**使用示例**：

```javascript
// Node.js 环境
const buffer = vchart.getImageBuffer();
require('fs').writeFileSync('chart.png', buffer);
```

---

## 使用场景

### 场景 1: 下载图表为图片

```javascript
async function downloadChart() {
  await vchart.exportImg('chart-' + Date.now());
}
```

### 场景 2: 预览图表缩略图

```javascript
async function showThumbnail() {
  const dataURL = await vchart.getDataURL();
  document.getElementById('thumbnail').src = dataURL;
}
```

### 场景 3: 上传图表到服务器

```javascript
async function uploadChart() {
  const dataURL = await vchart.getDataURL();

  // 将 base64 转为 Blob
  const response = await fetch(dataURL);
  const blob = await response.blob();

  // 上传
  const formData = new FormData();
  formData.append('chart', blob, 'chart.png');

  await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
}
```

### 场景 4: 打印图表

```javascript
async function printChart() {
  const dataURL = await vchart.getDataURL();

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <body>
        <img src="${dataURL}" />
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
```

### 场景 5: 生成报告

```javascript
async function generateReport() {
  const chartImage = await vchart.getDataURL();

  const report = {
    title: '销售报告',
    date: new Date().toISOString(),
    chart: chartImage,
    data: chartData
  };

  // 发送到报告生成服务
  await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  });
}
```

---

## 导出选项

### 设置导出尺寸

在 spec 中配置：

```javascript
const spec = {
  type: 'bar',
  width: 800,   // 导出宽度
  height: 600,  // 导出高度
  // ...
};
```

### 设置背景色

```javascript
const spec = {
  type: 'bar',
  background: 'white',  // 导出背景色
  // ...
};
```

### 设置设备像素比

```javascript
const vchart = new VChart(spec, {
  dom: 'chart',
  mode: 'desktop-browser',
  modeParams: {
    devicePixelRatio: 2  // 高清导出
  }
});
```

---

## 注意事项

### 1. 渲染完成后导出

```javascript
// ❌ 错误 - 渲染前导出
const vchart = new VChart(spec, { dom });
await vchart.exportImg(); // 可能失败

// ✅ 正确 - 渲染后导出
await vchart.renderAsync();
await vchart.exportImg();
```

### 2. 动画完成后再导出

```javascript
// 等待动画完成
vchart.on('animationFinished', async () => {
  await vchart.exportImg('chart');
});
```

### 3. 跨域问题

如果图表中包含跨域图片，导出可能会失败：

```javascript
// 解决方案：使用代理或转存图片
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
    <button onclick="downloadImage()">下载图片</button>
    <button onclick="showPreview()">显示预览</button>
    <button onclick="copyToClipboard()">复制到剪贴板</button>
  </div>

  <div id="preview" style="margin-top: 20px;"></div>

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
      background: 'white'
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    async function downloadImage() {
      await vchart.exportImg('my-chart');
      alert('图片已下载');
    }

    async function showPreview() {
      const dataURL = await vchart.getDataURL();
      document.getElementById('preview').innerHTML =
        `<img src="${dataURL}" style="max-width: 300px; border: 1px solid #ccc;">`;
    }

    async function copyToClipboard() {
      const dataURL = await vchart.getDataURL();
      const response = await fetch(dataURL);
      const blob = await response.blob();

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('已复制到剪贴板');
      } catch (err) {
        alert('复制失败: ' + err.message);
      }
    }
  </script>
</body>
</html>
```
