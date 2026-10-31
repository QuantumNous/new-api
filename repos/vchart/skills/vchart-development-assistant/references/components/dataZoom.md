# 数据缩放配置 (DataZoom)

## 基础配置

```javascript
dataZoom: [
  {
    orient: 'bottom',
    start: 0,
    end: 1
  }
]
```

## 位置配置 (orient)

| 值 | 说明 |
|---|------|
| `'bottom'` | 底部（水平） |
| `'top'` | 顶部（水平） |
| `'left'` | 左侧（垂直） |
| `'right'` | 右侧（垂直） |

## 范围配置

```javascript
dataZoom: [
  {
    orient: 'bottom',
    
    // 初始范围 (0-1 之间的比例)
    start: 0.2,          // 起始位置 20%
    end: 0.8,            // 结束位置 80%
    
    // 或使用百分比字符串
    startValue: '20%',
    endValue: '80%',
    
    // 或使用具体数据值
    startValue: '2024-01',
    endValue: '2024-06',
    
    // 范围限制
    rangeMode: ['percent', 'percent'],  // 'percent' | 'value'
    minSpan: 0.1,        // 最小范围 10%
    maxSpan: 1           // 最大范围 100%
  }
]
```

## 背景图表

```javascript
dataZoom: [
  {
    orient: 'bottom',
    
    // 显示缩略图背景
    showDetail: true,
    backgroundChart: {
      line: {
        style: {
          stroke: '#999',
          lineWidth: 1
        }
      },
      area: {
        style: {
          fill: 'rgba(153, 153, 153, 0.2)'
        }
      }
    }
  }
]
```

## 滑块样式

```javascript
dataZoom: [
  {
    orient: 'bottom',
    
    // 中间区域（选中区域）
    middleHandler: {
      visible: true,
      icon: {
        style: {
          fill: '#1890ff',
          stroke: '#1890ff'
        }
      },
      background: {
        style: {
          fill: 'rgba(24, 144, 255, 0.2)'
        }
      }
    },
    
    // 起始手柄
    startHandler: {
      visible: true,
      style: {
        fill: '#1890ff'
      }
    },
    
    // 结束手柄
    endHandler: {
      visible: true,
      style: {
        fill: '#1890ff'
      }
    },
    
    // 文字标签
    startText: {
      visible: true,
      style: {
        fill: '#666',
        fontSize: 10
      },
      formatMethod: (value) => value
    },
    endText: {
      visible: true,
      style: {
        fill: '#666',
        fontSize: 10
      }
    }
  }
]
```

## 轨道样式

```javascript
dataZoom: [
  {
    orient: 'bottom',
    
    // 轨道背景
    background: {
      style: {
        fill: '#f0f0f0',
        cornerRadius: 4
      }
    },
    
    // 选中区域
    selectedBackground: {
      style: {
        fill: 'rgba(24, 144, 255, 0.3)',
        cornerRadius: 4
      }
    }
  }
]
```

## 尺寸配置

```javascript
dataZoom: [
  {
    orient: 'bottom',
    height: 30,           // 高度（水平方向）
    // width: 30,         // 宽度（垂直方向）
    
    // 与图表的间距
    padding: {
      top: 10
    }
  }
]
```

## 关联配置

```javascript
// 关联特定轴
dataZoom: [
  {
    orient: 'bottom',
    axisIndex: 0,         // 关联第一个X轴
    // 或
    axisId: 'bottomAxis', // 关联指定ID的轴
    
    // 过滤模式
    filterMode: 'filter', // 'filter' | 'weakFilter' | 'empty' | 'none'
  }
]
```

## 交互配置

```javascript
dataZoom: [
  {
    orient: 'bottom',
    
    // 是否可拖动
    roam: true,
    
    // 实时更新（拖动时）
    realTime: true,
    
    // 锁定选择区域大小（只能平移）
    zoomLock: false,
    
    // 自动范围调整
    auto: false
  }
]
```

## 多个 DataZoom

```javascript
dataZoom: [
  // 底部 X 轴缩放
  {
    orient: 'bottom',
    axisIndex: 0,
    start: 0,
    end: 1
  },
  // 右侧 Y 轴缩放
  {
    orient: 'right',
    axisIndex: 1,
    start: 0,
    end: 1
  }
]
```

## 完整示例

```javascript
dataZoom: [
  {
    orient: 'bottom',
    
    // 初始范围
    start: 0,
    end: 0.5,
    
    // 范围限制
    minSpan: 0.1,
    maxSpan: 1,
    
    // 尺寸
    height: 40,
    padding: { top: 10, bottom: 10 },
    
    // 背景图表
    showDetail: true,
    backgroundChart: {
      line: {
        style: { stroke: '#bbb', lineWidth: 1 }
      },
      area: {
        style: { fill: 'rgba(187, 187, 187, 0.2)' }
      }
    },
    
    // 选中区域
    selectedBackground: {
      style: {
        fill: 'rgba(24, 144, 255, 0.15)',
        cornerRadius: 4
      }
    },
    
    // 手柄
    startHandler: {
      visible: true,
      style: {
        fill: '#1890ff',
        symbolType: 'rect',
        width: 8,
        height: 24,
        cornerRadius: 4
      }
    },
    endHandler: {
      visible: true,
      style: {
        fill: '#1890ff',
        symbolType: 'rect',
        width: 8,
        height: 24,
        cornerRadius: 4
      }
    },
    
    // 文字
    startText: {
      visible: true,
      style: {
        fill: '#666',
        fontSize: 10
      }
    },
    endText: {
      visible: true,
      style: {
        fill: '#666',
        fontSize: 10
      }
    },
    
    // 交互
    roam: true,
    realTime: true
  }
]
```

## 事件监听

```javascript
vchart.on('dataZoom', (params) => {
  console.log('DataZoom 范围变化:', params.start, params.end);
});
```
