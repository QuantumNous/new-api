# 十字准星配置 (Crosshair)

## 基础配置

```javascript
crosshair: {
  xField: {
    visible: true
  },
  yField: {
    visible: true
  }
}
```

## X轴方向（垂直线）

```javascript
crosshair: {
  xField: {
    visible: true,
    
    // 线类型
    line: {
      type: 'line',      // 'line' | 'rect'
      visible: true,
      style: {
        stroke: '#1890ff',
        lineWidth: 1,
        lineDash: [4, 4],
        opacity: 0.8
      }
    },
    
    // 标签
    label: {
      visible: true,
      style: {
        fill: '#fff',
        fontSize: 12
      },
      // 标签背景
      labelBackground: {
        visible: true,
        style: {
          fill: '#1890ff',
          cornerRadius: 4
        },
        padding: { top: 4, bottom: 4, left: 8, right: 8 }
      },
      // 格式化
      formatMethod: (value) => `X: ${value}`
    }
  }
}
```

## Y轴方向（水平线）

```javascript
crosshair: {
  yField: {
    visible: true,
    
    line: {
      type: 'line',
      visible: true,
      style: {
        stroke: '#52c41a',
        lineWidth: 1,
        lineDash: [4, 4]
      }
    },
    
    label: {
      visible: true,
      style: {
        fill: '#fff',
        fontSize: 12
      },
      labelBackground: {
        visible: true,
        style: {
          fill: '#52c41a',
          cornerRadius: 4
        },
        padding: { top: 4, bottom: 4, left: 8, right: 8 }
      },
      formatMethod: (value) => `Y: ${value.toFixed(2)}`
    }
  }
}
```

## 线类型

### 线条类型

```javascript
crosshair: {
  xField: {
    visible: true,
    line: {
      type: 'line',       // 单条线
      style: {
        stroke: '#999',
        lineDash: [4, 4]
      }
    }
  }
}
```

### 矩形类型（条带）

```javascript
crosshair: {
  xField: {
    visible: true,
    line: {
      type: 'rect',       // 矩形条带
      style: {
        fill: 'rgba(24, 144, 255, 0.1)',
        stroke: 'rgba(24, 144, 255, 0.3)',
        lineWidth: 1
      },
      // 宽度（仅rect类型）
      width: '100%'       // 自动适应类目宽度
    }
  }
}
```

## 触发配置

```javascript
crosshair: {
  // 触发方式
  trigger: 'hover',       // 'hover' | 'click'
  
  // 触发轴
  triggerOff: 'none',     // 关闭触发的方式
  
  xField: {
    visible: true,
    // ...
  }
}
```

## 多轴配置

```javascript
crosshair: {
  xField: {
    visible: true,
    // 绑定到特定轴
    bindingAxesIndex: [0]
  },
  yField: {
    visible: true,
    bindingAxesIndex: [0]   // 左Y轴
  },
  // 如果有右Y轴
  yField2: {
    visible: true,
    bindingAxesIndex: [1]   // 右Y轴
  }
}
```

## 极坐标系十字准星

```javascript
// 雷达图/玫瑰图
crosshair: {
  categoryField: {
    visible: true,
    line: {
      type: 'line',
      style: {
        stroke: '#999'
      }
    }
  },
  valueField: {
    visible: true,
    line: {
      type: 'line',
      style: {
        stroke: '#999'
      }
    }
  }
}
```

## 禁用十字准星

```javascript
crosshair: {
  xField: {
    visible: false
  },
  yField: {
    visible: false
  }
}

// 或完全禁用
crosshair: false
```

## 完整示例

```javascript
crosshair: {
  xField: {
    visible: true,
    line: {
      type: 'line',
      visible: true,
      style: {
        stroke: '#1890ff',
        lineWidth: 1,
        lineDash: [4, 4],
        opacity: 0.8
      }
    },
    label: {
      visible: true,
      style: {
        fill: '#fff',
        fontSize: 11,
        fontWeight: 500
      },
      labelBackground: {
        visible: true,
        style: {
          fill: '#1890ff',
          cornerRadius: 4
        },
        padding: { top: 4, bottom: 4, left: 8, right: 8 }
      }
    }
  },
  yField: {
    visible: true,
    line: {
      type: 'line',
      visible: true,
      style: {
        stroke: '#52c41a',
        lineWidth: 1,
        lineDash: [4, 4],
        opacity: 0.8
      }
    },
    label: {
      visible: true,
      style: {
        fill: '#fff',
        fontSize: 11,
        fontWeight: 500
      },
      labelBackground: {
        visible: true,
        style: {
          fill: '#52c41a',
          cornerRadius: 4
        },
        padding: { top: 4, bottom: 4, left: 8, right: 8 }
      },
      formatMethod: (value) => {
        return typeof value === 'number' ? value.toLocaleString() : value;
      }
    }
  }
}
```

## 常见配置场景

### 只显示X轴十字线

```javascript
crosshair: {
  xField: {
    visible: true,
    line: {
      type: 'line',
      style: { stroke: '#999', lineDash: [4, 4] }
    }
  }
}
```

### 使用矩形高亮当前类目

```javascript
crosshair: {
  xField: {
    visible: true,
    line: {
      type: 'rect',
      style: {
        fill: 'rgba(0, 0, 0, 0.05)'
      }
    },
    label: {
      visible: false
    }
  }
}
```

### 同时显示数值标签

```javascript
crosshair: {
  xField: {
    visible: true,
    line: { type: 'line', style: { stroke: '#999' } },
    label: {
      visible: true,
      labelBackground: {
        visible: true,
        style: { fill: '#333' }
      }
    }
  },
  yField: {
    visible: true,
    line: { type: 'line', style: { stroke: '#999' } },
    label: {
      visible: true,
      labelBackground: {
        visible: true,
        style: { fill: '#333' }
      }
    }
  }
}
```
