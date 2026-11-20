# Tooltip 配置

## 基础配置

```javascript
tooltip: {
  visible: true,
  trigger: 'axis'     // 触发方式
}
```

## 触发方式 (trigger)

| 值 | 说明 | 适用场景 |
|---|------|---------|
| `'mark'` | 图元触发 | 散点图、饼图等 |
| `'axis'` | 坐标轴触发 | 折线图、柱状图等 |

```javascript
// mark 触发 - hover到具体图形才显示
tooltip: {
  trigger: 'mark'
}

// axis 触发 - hover到X轴位置就显示
tooltip: {
  trigger: 'axis'
}
```

## 内容配置

### mark 类型内容

```javascript
tooltip: {
  mark: {
    // 标题
    title: {
      visible: true,
      value: (datum) => datum.category
    },
    
    // 内容
    content: [
      {
        key: '数值',                    // 左侧标签
        value: (datum) => datum.value   // 右侧数值
      },
      {
        key: '占比',
        value: (datum) => `${(datum.ratio * 100).toFixed(1)}%`
      }
    ]
  }
}
```

### dimension 类型内容（axis触发）

```javascript
tooltip: {
  trigger: 'axis',
  dimension: {
    title: {
      value: (datum) => datum[0]?.category
    },
    content: [
      {
        key: (datum) => datum.type,
        value: (datum) => datum.value
      }
    ]
  }
}
```

## 内容格式化

### 基础格式化

```javascript
tooltip: {
  mark: {
    content: [
      {
        key: '销售额',
        value: (datum) => {
          // 数值格式化
          return datum.value.toLocaleString() + ' 元';
        }
      }
    ]
  }
}
```

### 条件显示

```javascript
tooltip: {
  mark: {
    content: [
      {
        key: '状态',
        value: (datum) => datum.value > 100 ? '达标' : '未达标',
        visible: (datum) => datum.value !== null  // 条件显示
      }
    ]
  }
}
```

### 自定义形状颜色

```javascript
tooltip: {
  mark: {
    content: [
      {
        key: '系列A',
        value: (datum) => datum.value,
        shapeType: 'circle',
        shapeColor: '#1890ff'
      }
    ]
  }
}
```

## 样式配置

```javascript
tooltip: {
  style: {
    // 面板样式
    panel: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      border: {
        color: '#333',
        width: 1,
        radius: 4
      },
      shadow: {
        x: 0,
        y: 2,
        blur: 10,
        color: 'rgba(0, 0, 0, 0.2)'
      },
      padding: {
        top: 10,
        bottom: 10,
        left: 14,
        right: 14
      }
    },
    
    // 标题样式
    titleLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#fff'
    },
    
    // 内容键样式
    keyLabel: {
      fontSize: 12,
      fill: '#aaa'
    },
    
    // 内容值样式
    valueLabel: {
      fontSize: 12,
      fill: '#fff'
    },
    
    // 形状样式
    shape: {
      size: 8,
      spacing: 6
    }
  }
}
```

## 位置配置

```javascript
tooltip: {
  // 偏移
  offsetX: 10,
  offsetY: 10,
  
  // 固定位置（不跟随鼠标）
  fixedPosition: true,
  position: {
    x: 100,
    y: 100
  },
  
  // 或使用函数
  position: (event, params) => {
    return {
      x: event.canvasX + 20,
      y: event.canvasY + 20
    };
  },
  
  // 限制在图表区域内
  confine: true
}
```

## 交互配置

```javascript
tooltip: {
  // 进入延迟
  enterable: true,        // 鼠标可进入tooltip
  
  // 显示延迟
  showDelay: 50,
  
  // 隐藏延迟  
  hideDelay: 100,
  
  // 过渡动画
  transitionDuration: 100
}
```

## 自定义渲染

### 使用 renderMode

```javascript
tooltip: {
  renderMode: 'html',      // 'canvas' | 'html'
  
  // HTML模式可以完全自定义
  handler: {
    showTooltip: (activeType, data, params) => {
      // 自定义显示逻辑
      const container = document.getElementById('custom-tooltip');
      container.innerHTML = `<div>${data[0].datum.value}</div>`;
      container.style.display = 'block';
    },
    hideTooltip: () => {
      document.getElementById('custom-tooltip').style.display = 'none';
    }
  }
}
```

### DOM 自定义

```javascript
tooltip: {
  mark: {
    content: [
      {
        // 使用DOM配置
        hasShape: true,
        key: (datum) => datum.type,
        value: (datum) => {
          return {
            type: 'rich',
            text: [
              { text: datum.value, fill: '#333', fontWeight: 'bold' },
              { text: ' 元', fill: '#999' }
            ]
          };
        }
      }
    ]
  }
}
```

## 禁用 Tooltip

```javascript
// 完全禁用
tooltip: {
  visible: false
}

// 或在特定系列禁用
series: [
  {
    type: 'bar',
    tooltip: {
      visible: false
    }
  }
]
```

## 完整示例

```javascript
tooltip: {
  visible: true,
  trigger: 'axis',
  
  dimension: {
    title: {
      value: (datum) => datum[0]?.month || ''
    },
    content: [
      {
        key: (datum) => datum.type,
        value: (datum) => `${datum.value.toLocaleString()} 万元`,
        shapeType: 'square'
      }
    ]
  },
  
  style: {
    panel: {
      backgroundColor: '#fff',
      border: {
        color: '#e8e8e8',
        width: 1,
        radius: 8
      },
      shadow: {
        x: 0,
        y: 4,
        blur: 12,
        color: 'rgba(0, 0, 0, 0.15)'
      },
      padding: { top: 12, bottom: 12, left: 16, right: 16 }
    },
    titleLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#333'
    },
    keyLabel: {
      fontSize: 12,
      fill: '#666'
    },
    valueLabel: {
      fontSize: 12,
      fill: '#333',
      fontWeight: 500
    }
  },
  
  enterable: false,
  confine: true,
  transitionDuration: 150
}
```
