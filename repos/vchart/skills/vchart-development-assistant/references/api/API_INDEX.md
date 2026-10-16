# VChart API 索引

## API 分类概览

VChart API 分为以下几大类别：

| 分类 | 用途 | 常见场景 |
|------|------|---------|
| **数据操作** | 动态更新图表数据 | 数据刷新、实时数据、数据筛选 |
| **图表更新** | 动态修改图表配置 | 切换图表类型、修改样式、更新标题 |
| **状态管理** | 控制图元状态 | 高亮、选中、hover 效果 |
| **事件监听** | 响应用户交互 | 点击、hover、图例筛选 |
| **主题切换** | 动态切换主题 | 深色模式、品牌主题 |
| **交互控制** | 手动触发交互 | 显示 tooltip、crosshair、dimension |
| **导出功能** | 导出图表 | 图片导出、获取 dataURL |
| **尺寸调整** | 响应式布局 | 窗口 resize、容器尺寸变化 |
| **图例操作** | 控制图例状态 | 图例选中、获取图例数据 |
| **动画控制** | 控制动画播放 | 暂停、恢复、停止动画 |
| **坐标转换** | 数据与坐标转换 | 自定义标注、点击位置转换 |
| **实例获取** | 获取内部实例 | 获取 chart、stage、canvas |

---

## 快速查找 API

### 按用户需求查找

| 用户需求 | 推荐 API | 文档链接 |
|---------|---------|---------|
| 更新图表数据 | `updateData` / `updateDataSync` | [data-api.md](data-api.md) |
| 切换图表类型 | `updateSpec` / `updateSpecSync` | [spec-api.md](spec-api.md) |
| 高亮某个数据 | `setHovered` / `setSelected` | [state-api.md](state-api.md) |
| 响应点击事件 | `on('click')` | [event-api.md](event-api.md) |
| 切换深色模式 | `setCurrentTheme` | [theme-api.md](theme-api.md) |
| 手动显示 tooltip | `showTooltip` / `hideTooltip` | [interaction-api.md](interaction-api.md) |
| 导出图片 | `exportImg` / `getDataURL` | [export-api.md](export-api.md) |
| 窗口 resize | `resize` | [layout-api.md](layout-api.md) |
| 控制图例选中 | `setLegendSelectedDataById` | [legend-api.md](legend-api.md) |
| 暂停动画 | `pauseAnimation` / `resumeAnimation` | [animation-api.md](animation-api.md) |
| 数据坐标转换 | `convertDatumToPosition` | [coordinate-api.md](coordinate-api.md) |

---

## 快速查找 API

### 按用户需求查找

| 用户需求 | 推荐 API | 文档链接 |
|---------|---------|---------|
| 更新图表数据 | `updateData` / `updateDataSync` | [data-api.md](data-api.md) |
| 切换图表类型 | `updateSpec` / `updateSpecSync` | [spec-api.md](spec-api.md) |
| 高亮某个数据 | `setHovered` / `setSelected` | [state-api.md](state-api.md) |
| 响应点击事件 | `on('click')` | [event-api.md](event-api.md) |
| 切换深色模式 | `setCurrentTheme` | [theme-api.md](theme-api.md) |
| 手动显示 tooltip | `showTooltip` / `hideTooltip` | [tooltip-api.md](tooltip-api.md) |
| 导出图片 | `exportImg` / `getDataURL` | [export-api.md](export-api.md) |
| 窗口 resize | `resize` | [layout-api.md](layout-api.md) |
| 控制图例选中 | `setLegendSelectedDataById` | [legend-api.md](legend-api.md) |
| 暂停动画 | `pauseAnimation` / `resumeAnimation` | [animation-api.md](animation-api.md) |
| 数据坐标转换 | `convertDatumToPosition` | [coordinate-api.md](coordinate-api.md) |

---

## API 详细文档

### 核心数据操作 API

**文档**: [data-api.md](data-api.md)

| API | 同步/异步 | 用途 |
|-----|----------|------|
| `updateData` | 异步 | 更新指定数据集 |
| `updateDataSync` | 同步 | 同步更新数据集 |
| `updateDataInBatches` | 异步 | 批量更新多个数据集 |
| `updateFullData` | 异步 | 更新完整数据对象 |
| `updateFullDataSync` | 同步 | 同步更新完整数据 |

### Spec 配置更新 API

**文档**: [spec-api.md](spec-api.md)

| API | 同步/异步 | 用途 |
|-----|----------|------|
| `updateSpec` | 异步 | 更新完整 spec |
| `updateSpecSync` | 同步 | 同步更新 spec |
| `updateModelSpec` | 异步 | 更新模块 spec |
| `updateModelSpecSync` | 同步 | 同步更新模块 spec |

### 状态管理 API

**文档**: [state-api.md](state-api.md)

| API | 用途 |
|-----|------|
| `setHovered` | 设置 hover 状态 |
| `setSelected` | 设置选中状态 |
| `updateState` | 更新自定义状态 |
| `clearHovered` | 清除 hover 状态 |
| `clearSelected` | 清除选中状态 |
| `clearState` | 清除指定状态 |

### 事件监听 API

**文档**: [event-api.md](event-api.md)

| API | 用途 |
|-----|------|
| `on` | 添加事件监听 |
| `off` | 移除事件监听 |

### 主题切换 API

**文档**: [theme-api.md](theme-api.md)

| API | 用途 |
|-----|------|
| `setCurrentTheme` | 设置当前主题 |
| `getCurrentTheme` | 获取当前主题 |
| `getCurrentThemeName` | 获取当前主题名称 |

### 交互控制 API

**文档**: [interaction-api.md](interaction-api.md)

| API | 用途 |
|-----|------|
| `showTooltip` | 手动显示 tooltip |
| `hideTooltip` | 隐藏 tooltip |
| `setDimensionIndex` | 触发 dimension 交互 |
| `disableTooltip` | 禁用/启用 tooltip |
| `disableCrossHair` | 禁用/启用 crosshair |
| `disableDimensionHoverEvent` | 禁用/启用 dimension hover |

### 导出功能 API

**文档**: [export-api.md](export-api.md)

| API | 用途 |
|-----|------|
| `exportImg` | 导出图片文件 |
| `getDataURL` | 获取 dataURL |
| `exportCanvas` | 导出 canvas 元素 |
| `getImageBuffer` | 获取图片 buffer（Node.js） |

### 图例操作 API

**文档**: [legend-api.md](legend-api.md)

| API | 用途 |
|-----|------|
| `setLegendSelectedDataById` | 设置图例选中项 |
| `setLegendSelectedDataByIndex` | 按索引设置图例选中项 |
| `getLegendSelectedDataById` | 获取图例选中项 |
| `getLegendDataById` | 获取图例数据 |

### 动画控制 API

**文档**: [animation-api.md](animation-api.md)

| API | 用途 |
|-----|------|
| `pauseAnimation` | 暂停动画 |
| `resumeAnimation` | 恢复动画 |
| `stopAnimation` | 停止动画 |
| `isAnimationEnable` | 检查动画是否启用 |

### 坐标转换 API

**文档**: [coordinate-api.md](coordinate-api.md)

| API | 用途 |
|-----|------|
| `convertDatumToPosition` | 数据转换为坐标位置 |
| `convertValueToPosition` | 数值转换为坐标位置 |

### 布局与尺寸 API

**文档**: [layout-api.md](layout-api.md)

| API | 用途 |
|-----|------|
| `resize` | 调整图表尺寸 |
| `updateViewBox` | 更新绘制区域 |
| `setLayout` | 设置自定义布局 |
| `reLayout` | 强制重新布局 |

---

## API 使用模式

### 同步 vs 异步选择

**推荐使用异步 API**（默认）：
```javascript
// ✅ 推荐：异步 API
await vchart.updateData('id', newData);
await vchart.updateSpec(newSpec);
await vchart.resize(800, 600);
```

**使用同步 API 的场景**：
```javascript
// 适用于需要立即获取结果的场景
vchart.updateDataSync('id', newData);
const position = vchart.convertDatumToPosition(datum);
```

### 链式调用

大多数 API 返回 VChart 实例，支持链式调用：
```javascript
vchart
  .updateDataSync('data', newData)
  .setHovered(datum)
  .showTooltip(datum, options);
```

### 事件监听模式

```javascript
// 添加事件监听
vchart.on('click', (params) => {
  console.log('点击了图表', params);
});

// 带查询条件的事件监听
vchart.on('click', { seriesId: 'series0' }, (params) => {
  console.log('点击了指定系列', params);
});
```

---

## API 最佳实践

### 1. 数据更新场景选择

| 场景 | 推荐 API | 原因 |
|------|---------|------|
| 单个数据集更新 | `updateData` | 简单高效 |
| 多个数据集同时更新 | `updateDataInBatches` | 减少渲染次数 |
| 完整数据替换 | `updateFullData` | 更清晰的数据结构 |
| 实时数据刷新 | `updateDataSync` | 同步更新避免闪烁 |

### 2. Spec 更新 vs 数据更新

- **仅数据变化**：使用 `updateData` 系列 API
- **配置变化**：使用 `updateSpec` 系列 API
- **频繁更新**：优先考虑数据更新，性能更好

### 3. 状态管理时机

- **用户交互触发**：在事件回调中使用 `setHovered`/`setSelected`
- **程序控制**：在数据更新后手动设置状态
- **清除状态**：数据变化前调用 `clearHovered`/`clearSelected`

---

## 常见问题

### Q1: updateData 和 updateSpec 的区别？

**updateData**：仅更新数据，保留其他配置，性能更好。
**updateSpec**：更新完整配置，包括数据、样式、组件等。

### Q2: 何时使用同步 vs 异步 API？

- **异步 API**：大多数场景，不阻塞主线程
- **同步 API**：需要立即获取结果、调试场景

### Q3: 如何实现图表的响应式布局？

```javascript
window.addEventListener('resize', () => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  vchart.resize(width, height);
});
```

---

## 参考资源

- **官方 API 文档**: https://visactor.com/vchart/api/API/vchart
- **事件文档**: [event-api.md](event-api.md)
- **示例代码**: GitHub `docs/assets/examples/`