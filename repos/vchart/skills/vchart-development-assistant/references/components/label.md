# 数据标签配置 (Label)

## 基础配置

```javascript
label: {
  visible: true
}
```

## 位置配置

### 笛卡尔坐标系（柱/线/面积）

| 位置 | 说明 |
|-----|------|
| `'top'` | 上方 |
| `'bottom'` | 下方 |
| `'left'` | 左侧 |
| `'right'` | 右侧 |
| `'inside'` | 内部居中 |
| `'inside-top'` | 内部上方 |
| `'inside-bottom'` | 内部下方 |

```javascript
label: {
  visible: true,
  position: 'top'
}
```

### 饼图

| 位置 | 说明 |
|-----|------|
| `'outside'` | 外部 |
| `'inside'` | 内部 |

```javascript
label: {
  visible: true,
  position: 'outside'
}
```

## 样式配置

```javascript
label: {
  visible: true,
  style: {
    fill: '#333',
    fontSize: 12,
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    
    // 文字描边
    stroke: '#fff',
    lineWidth: 2
  }
}
```

## 格式化

```javascript
label: {
  visible: true,
  formatMethod: (value, datum, ctx) => {
    // value: 原始值
    // datum: 数据项
    // ctx: 上下文信息
    
    // 数值格式化
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    // 百分比
    return `${(value * 100).toFixed(1)}%`;
  }
}
```

## 偏移配置

```javascript
label: {
  visible: true,
  offset: 5,           // 与图元的距离
  
  // 或分别设置
  offsetX: 0,
  offsetY: -5
}
```

## 防重叠

```javascript
label: {
  visible: true,
  
  // 自动隐藏重叠标签
  overlap: {
    strategy: 'bound',   // 'bound' | 'fixedIndex'
    avoidBaseMark: true  // 避开图元
  },
  
  // 或使用智能布局
  smartInvert: true      // 根据背景自动调整颜色
}
```

## 条件显示

```javascript
label: {
  visible: (datum) => datum.value > 100,  // 函数形式
  
  // 或在 formatMethod 中返回空
  formatMethod: (value, datum) => {
    if (datum.value < 50) return '';  // 不显示
    return value;
  }
}
```

## 系列标签配置

在系列配置中设置标签：

```javascript
// 柱状图
bar: {
  style: { /* 柱子样式 */ }
},
label: {
  visible: true,
  position: 'top'
}

// 折线图
line: {
  style: { /* 线条样式 */ }
},
point: {
  style: { /* 点样式 */ }
},
label: {
  visible: true,
  position: 'top'
}

// 饼图
pie: {
  style: { /* 扇区样式 */ }
},
label: {
  visible: true,
  position: 'outside'
}
```

## 饼图引导线

```javascript
label: {
  visible: true,
  position: 'outside',
  
  // 引导线
  line: {
    visible: true,
    line1MinLength: 20,   // 第一段最小长度
    line2MinLength: 10,   // 第二段最小长度
    style: {
      stroke: '#999',
      lineWidth: 1
    }
  },
  
  // 布局
  layout: {
    align: 'labelLine',   // 'arc' | 'labelLine' | 'edge'
    strategy: 'priority', // 'priority' | 'vertical' | 'none'
    tangentConstraint: true
  }
}
```

## 多行标签

```javascript
label: {
  visible: true,
  formatMethod: (value, datum) => {
    return `${datum.category}\n${value}`;  // 使用换行符
  },
  style: {
    lineHeight: 18
  }
}
```

## 富文本标签

```javascript
label: {
  visible: true,
  formatMethod: (value, datum) => {
    return {
      type: 'rich',
      text: [
        { text: datum.category, fill: '#666', fontSize: 10 },
        { text: '\n' },
        { text: String(value), fill: '#333', fontSize: 14, fontWeight: 'bold' }
      ]
    };
  }
}
```

## 堆叠图标签

```javascript
// 堆叠柱状图
const spec = {
  type: 'bar',
  stack: true,
  label: {
    visible: true,
    position: 'inside',
    style: {
      fill: '#fff'
    },
    // 只显示大于阈值的标签
    formatMethod: (value, datum) => {
      return value > 50 ? value : '';
    }
  }
};

// 如需显示总计
extensionMark: [
  {
    type: 'text',
    dataId: 'data',
    visible: true,
    style: {
      text: (datum) => datum._stack_total,
      x: (datum, ctx) => ctx.valueToX([datum.category]),
      y: (datum, ctx) => ctx.valueToY([datum._stack_end]),
      textAlign: 'center',
      textBaseline: 'bottom',
      fill: '#333'
    }
  }
]
```

## 完整示例

### 柱状图标签

```javascript
label: {
  visible: true,
  position: 'top',
  offset: 5,
  style: {
    fill: '#333',
    fontSize: 12
  },
  formatMethod: (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value;
  }
}
```

### 饼图标签

```javascript
label: {
  visible: true,
  position: 'outside',
  line: {
    visible: true,
    style: { stroke: '#999' }
  },
  layout: {
    align: 'labelLine',
    strategy: 'priority'
  },
  style: {
    fontSize: 12,
    fill: '#333'
  },
  formatMethod: (text, datum) => {
    return `${datum.category}: ${datum.value} (${(datum.ratio * 100).toFixed(1)}%)`;
  }
}
```

### 折线图标签（只显示最后一个点）

```javascript
label: {
  visible: true,
  position: 'right',
  style: {
    fill: '#333',
    fontSize: 12
  },
  formatMethod: (value, datum, ctx) => {
    const data = ctx.data;
    const lastIndex = data.length - 1;
    const currentIndex = data.findIndex(d => d === datum);
    
    if (currentIndex === lastIndex) {
      return value;
    }
    return '';
  }
}
```
