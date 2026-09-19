# 动画控制 API

## 概述

动画控制 API 用于控制图表动画的播放、暂停和停止。

---

## API 列表

### isAnimationEnable

**检查动画是否启用**

```typescript
isAnimationEnable(): boolean;
```

**返回值**：动画是否启用

**使用示例**：

```javascript
if (vchart.isAnimationEnable()) {
  console.log('动画已启用');
}
```

---

### pauseAnimation

**暂停动画**

```typescript
pauseAnimation(): void;
```

**使用示例**：

```javascript
vchart.pauseAnimation();
```

---

### resumeAnimation

**恢复动画**

```typescript
resumeAnimation(): void;
```

**使用示例**：

```javascript
vchart.resumeAnimation();
```

---

### stopAnimation

**停止动画**

```typescript
stopAnimation(): void;
```

**使用示例**：

```javascript
vchart.stopAnimation();
```

---

## 使用场景

### 场景 1: 数据更新时跳过动画

```javascript
async function quickUpdate() {
  // 暂停动画
  vchart.pauseAnimation();

  // 更新数据
  await vchart.updateData('data', newData);

  // 停止动画（不播放剩余动画）
  vchart.stopAnimation();
}
```

### 场景 2: 用户控制动画播放

```javascript
let isPaused = false;

document.getElementById('toggle-animation').addEventListener('click', () => {
  if (isPaused) {
    vchart.resumeAnimation();
  } else {
    vchart.pauseAnimation();
  }
  isPaused = !isPaused;
});
```

### 场景 3: 动画完成后执行操作

```javascript
vchart.on('animationFinished', () => {
  console.log('动画播放完成');
  // 显示操作提示
  showTip('可以点击图表进行交互');
});
```

---

## 动画配置

### Spec 中配置动画

```javascript
const spec = {
  type: 'bar',
  data: [{ id: 'data', values: [...] }],
  xField: 'category',
  yField: 'value',

  // 动画配置
  animation: true,  // 启用动画
  animationAppear: {
    duration: 1000,
    easing: 'cubicOut'
  },
  animationEnter: {
    duration: 500,
    easing: 'linear'
  },
  animationExit: {
    duration: 300
  },
  animationUpdate: {
    duration: 500
  }
};
```

### 关闭动画

```javascript
// 方式 1: spec 中关闭
const spec = {
  type: 'bar',
  animation: false,
  // ...
};

// 方式 2: 动态停止
vchart.stopAnimation();
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
    <button onclick="vchart.pauseAnimation()">暂停</button>
    <button onclick="vchart.resumeAnimation()">恢复</button>
    <button onclick="vchart.stopAnimation()">停止</button>
    <button onclick="updateData()">更新数据</button>
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
      animation: true,
      animationAppear: { duration: 2000 }
    };

    const vchart = new VChart(spec, { dom: 'chart' });
    vchart.renderSync();

    function updateData() {
      const newData = spec.data[0].values.map(d => ({
        category: d.category,
        value: Math.random() * 50
      }));
      vchart.updateDataSync('data', newData);
    }

    vchart.on('animationFinished', () => {
      console.log('动画完成');
    });
  </script>
</body>
</html>
```
