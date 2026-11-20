# VChart 常见问题速查

## 数据相关问题

### 1. 图表不显示数据

**症状**：图表渲染但没有数据显示

**排查步骤**：
1. 检查 `data.values` 是否为空数组
2. 检查字段映射（xField/yField/valueField）是否与数据字段名一致
3. 检查数据字段名是否有拼写错误（区分大小写）

```javascript
// ❌ 错误：字段名不匹配
data: [{ id: 'data', values: [{ Month: '1月', Value: 100 }] }],
xField: 'month',  // 应该是 'Month'
yField: 'value'   // 应该是 'Value'

// ✅ 正确
data: [{ id: 'data', values: [{ month: '1月', value: 100 }] }],
xField: 'month',
yField: 'value'
```

### 2. 数据更新后图表不刷新

**解决方案**：使用 `updateData` 方法

```javascript
// 更新数据
vchart.updateData('dataId', newValues);
```

### 3. 空值/缺失值处理

```javascript
// 方案1：在数据中填充 null
values: [
  { x: 'A', y: 10 },
  { x: 'B', y: null },  // 缺失值
  { x: 'C', y: 20 }
]

// 方案2：使用 invalidType 配置
line: {
  style: {
    // 遇到无效值时的处理方式
    // 'break': 断开 | 'link': 连接 | 'zero': 当作0
  }
}
```

---

## 样式相关问题

### 4. 如何修改默认颜色

```javascript
// 方案1：全局配置 color
const spec = {
  color: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
  // ...
};

// 方案2：在系列中配置
bar: {
  style: {
    fill: '#1890ff'
  }
}

// 方案3：使用主题
const vchart = new VChart(spec, { 
  dom: 'container',
  theme: 'dark'  // 或自定义主题
});
```

### 5. 渐变色配置

```javascript
bar: {
  style: {
    fill: {
      gradient: 'linear',
      x0: 0.5, y0: 0,
      x1: 0.5, y1: 1,
      stops: [
        { offset: 0, color: '#1890ff' },
        { offset: 1, color: '#096dd9' }
      ]
    }
  }
}
```

### 6. 条件样式（根据数据值设置样式）

```javascript
bar: {
  style: {
    fill: (datum) => datum.value > 100 ? '#52c41a' : '#f5222d'
  }
}
```

---

## 坐标轴问题

### 7. Y轴不从0开始

```javascript
axes: [
  {
    orient: 'left',
    min: 0,  // 强制从0开始
    // 或者
    zero: true
  }
]
```

### 8. 坐标轴标签被截断

```javascript
axes: [
  {
    orient: 'bottom',
    label: {
      autoRotate: true,        // 自动旋转
      autoRotateAngle: [0, 45, 90],  // 旋转角度候选
      autoHide: true,          // 自动隐藏重叠标签
      autoLimit: true          // 自动省略
    }
  }
]
```

### 9. 双Y轴配置

```javascript
axes: [
  { orient: 'bottom', type: 'band' },
  { 
    orient: 'left', 
    type: 'linear',
    seriesIndex: [0]  // 关联第一个系列
  },
  { 
    orient: 'right', 
    type: 'linear',
    seriesIndex: [1]  // 关联第二个系列
  }
]
```

---

## 图例问题

### 10. 隐藏图例

```javascript
legends: {
  visible: false
}
```

### 11. 图例位置调整

```javascript
legends: {
  visible: true,
  orient: 'right',     // 'top' | 'bottom' | 'left' | 'right'
  position: 'middle',  // 'start' | 'middle' | 'end'
  padding: { left: 20 }
}
```

### 12. 自定义图例内容

```javascript
legends: {
  visible: true,
  data: (data) => {
    return data.map(item => ({
      label: item.label + ' (自定义)',
      shape: { fill: item.shape.fill }
    }));
  }
}
```

---

## Tooltip 问题

### 13. 自定义 Tooltip 内容

```javascript
tooltip: {
  mark: {
    title: {
      value: (datum) => `标题: ${datum.category}`
    },
    content: [
      {
        key: '数值',
        value: (datum) => `${datum.value} 单位`
      }
    ]
  }
}
```

### 14. Tooltip 触发方式

```javascript
tooltip: {
  trigger: 'axis',    // 'axis' | 'mark'
  // axis: 按坐标轴触发（适合折线图）
  // mark: 按图元触发（适合散点图）
}
```

---

## 性能问题

### 15. 大数据量优化

```javascript
const spec = {
  // 关闭动画
  animation: false,
  
  // 或设置动画阈值
  animationThreshold: 1000,  // 数据量超过此值自动关闭动画
  
  // 使用采样
  sampling: 'lttb',  // 'lttb' | 'average' | 'max' | 'min' | 'sum'
  samplingFactor: 0.5
};
```

### 16. 按需加载图表类型

```javascript
import { VChart } from '@visactor/vchart';
import { registerBarChart, registerTooltip } from '@visactor/vchart';

// 只注册需要的图表和组件
VChart.useRegisters([registerBarChart, registerTooltip]);
```

---

## 交互问题

### 17. 禁用某些交互

```javascript
// 禁用 hover 效果
bar: {
  state: {
    hover: {
      // 不改变样式
    }
  }
}

// 禁用选中
select: false
```

### 18. 监听图表事件

```javascript
const vchart = new VChart(spec, { dom: 'container' });

// 点击事件
vchart.on('click', { level: 'mark' }, (params) => {
  console.log('点击数据:', params.datum);
});

// hover 事件
vchart.on('pointerover', { level: 'mark' }, (params) => {
  console.log('hover 数据:', params.datum);
});
```

---

## 响应式问题

### 19. 图表自适应容器大小

```javascript
const spec = {
  autoFit: true,  // 自动适应容器
  // 或指定尺寸
  width: 600,
  height: 400
};
```

### 20. 窗口 resize 后图表不更新

```javascript
// 监听窗口变化，手动触发 resize
window.addEventListener('resize', () => {
  vchart.resize();
});
```

---

## React/Vue 集成问题

### 21. React 中的基本用法

```jsx
import { BarChart } from '@visactor/react-vchart';

function App() {
  const spec = {/* spec配置 */};
  
  return <BarChart spec={spec} />;
}
```

### 22. Vue 中的基本用法

```vue
<template>
  <VChart :spec="spec" />
</template>

<script>
import { VChart } from '@visactor/vue-vchart';

export default {
  components: { VChart },
  data() {
    return {
      spec: {/* spec配置 */}
    };
  }
};
</script>
```

---

## 版本迁移问题

### 23. 从 1.x 升级到 2.0

主要变更：
1. 主题系统重构
2. 部分 API 名称调整
3. 动画配置优化

详细迁移指南请参考：[VChart 2.0 升级指南](https://www.visactor.io/vchart/guide/tutorial_docs/migrate)
