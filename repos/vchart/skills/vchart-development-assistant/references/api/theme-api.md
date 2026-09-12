# 主题切换 API

## 潜述

主题切换 API 用于动态切换图表主题，支持内置主题和自定义主题。

---

## 实例 API

### setCurrentTheme

**设置当前图表的主题**

```typescript
setCurrentTheme(name: string): Promise<IVChart>;
```

**参数**：
- `name`: 主题名称

**使用示例**：

```javascript
// 切换到深色主题
await vchart.setCurrentTheme('dark');

// 切换回默认主题
await vchart.setCurrentTheme('default');
```

---

### getCurrentTheme

**获取当前主题配置**

```typescript
getCurrentTheme(): ITheme;
```

**返回值**：当前主题配置对象

**使用示例**：

```javascript
const theme = vchart.getCurrentTheme();
console.log(theme.colors); // 主题色板
```

---

### getCurrentThemeName

**获取当前主题名称**

```typescript
getCurrentThemeName(): string;
```

**返回值**：主题名称

**使用示例**：

```javascript
const themeName = vchart.getCurrentThemeName();
console.log(themeName); // 'dark' 或 'default' 等
```

---

## 静态 API（VChart.ThemeManager）

### registerTheme

**注册自定义主题**

```typescript
VChart.ThemeManager.registerTheme(name: string, theme: Partial<ITheme>): void;
```

**使用示例**：

```javascript
// 注册自定义主题
VChart.ThemeManager.registerTheme('myTheme', {
  colors: ['#5B8FF9', '#5AD8A6', '#5D7092'],
  background: '#f5f5f5',
  title: {
    textStyle: {
      fill: '#333'
    }
  }
});

// 使用自定义主题
await vchart.setCurrentTheme('myTheme');
```

---

### getTheme

**获取指定主题**

```typescript
VChart.ThemeManager.getTheme(name: string): ITheme;
```

---

### removeTheme

**移除指定主题**

```typescript
VChart.ThemeManager.removeTheme(name: string): boolean;
```

---

### themeExist

**检查主题是否存在**

```typescript
VChart.ThemeManager.themeExist(name: string): boolean;
```

---

### setCurrentTheme（全局）

**设置全局默认主题**

```typescript
VChart.ThemeManager.setCurrentTheme(name: string): void;
```

---

## 内置主题

VChart 提供以下内置主题：

| 主题名 | 说明 |
|-------|------|
| `default` | 默认主题 |
| `dark` | 深色主题 |
| `cloud` | 云端主题 |

---

## 使用场景

### 场景 1: 深色模式切换

```javascript
let isDarkMode = false;

function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  vchart.setCurrentTheme(isDarkMode ? 'dark' : 'default');
}

// 监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  vchart.setCurrentTheme(e.matches ? 'dark' : 'default');
});
```

### 场景 2: 品牌主题

```javascript
// 注册品牌主题
VChart.ThemeManager.registerTheme('brand', {
  colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
  background: '#FAFAFA'
});

// 应用品牌主题
await vchart.setCurrentTheme('brand');
```

### 场景 3: 用户偏好主题

```javascript
// 保存用户主题偏好
function saveThemePreference(themeName) {
  localStorage.setItem('chart-theme', themeName);
}

// 加载用户主题偏好
function loadThemePreference() {
  const theme = localStorage.getItem('chart-theme') || 'default';
  vchart.setCurrentTheme(theme);
}
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
    <button onclick="setTheme('default')">默认主题</button>
    <button onclick="setTheme('dark')">深色主题</button>
    <button onclick="setTheme('custom')">自定义主题</button>
  </div>

  <script>
    // 注册自定义主题
    VChart.ThemeManager.registerTheme('custom', {
      colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
      background: '#FFF5F5'
    });

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

    async function setTheme(name) {
      await vchart.setCurrentTheme(name);
      console.log('当前主题:', vchart.getCurrentThemeName());
    }
  </script>
</body>
</html>
```
