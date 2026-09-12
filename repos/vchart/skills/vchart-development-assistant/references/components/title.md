# 标题配置

## 基础配置

```javascript
title: {
  visible: true,
  text: '图表标题'
}
```

## 主标题配置

```javascript
title: {
  visible: true,
  text: '主标题文本',
  
  // 位置
  orient: 'top',          // 'top' | 'bottom' | 'left' | 'right'
  align: 'center',        // 'left' | 'center' | 'right'
  verticalAlign: 'top',   // 'top' | 'middle' | 'bottom'
  
  // 间距
  padding: {
    top: 10,
    bottom: 10,
    left: 0,
    right: 0
  },
  
  // 样式
  textStyle: {
    fontSize: 18,
    fontWeight: 'bold',
    fill: '#333',
    fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
    lineHeight: 24
  }
}
```

## 副标题配置

```javascript
title: {
  visible: true,
  text: '主标题',
  subtext: '副标题描述文本',
  
  // 副标题样式
  subtextStyle: {
    fontSize: 12,
    fill: '#999',
    fontWeight: 'normal',
    lineHeight: 18
  }
}
```

## 位置配置

### orient - 标题区域位置

```javascript
// 顶部
title: { orient: 'top' }

// 底部
title: { orient: 'bottom' }

// 左侧（垂直文字）
title: { orient: 'left' }

// 右侧（垂直文字）
title: { orient: 'right' }
```

### align - 水平对齐

```javascript
// 左对齐
title: { align: 'left' }

// 居中
title: { align: 'center' }

// 右对齐
title: { align: 'right' }
```

### 精确位置

```javascript
title: {
  visible: true,
  text: '标题',
  
  // 使用百分比或像素
  x: '50%',              // 水平位置
  y: 20,                 // 垂直位置
  
  // 或使用 layoutType: 'absolute'
  layoutType: 'absolute'
}
```

## 多行标题

```javascript
title: {
  visible: true,
  text: ['第一行标题', '第二行标题'],
  textStyle: {
    lineHeight: 24
  }
}
```

## 富文本标题

```javascript
title: {
  visible: true,
  text: {
    type: 'rich',
    text: [
      { text: '销售额 ', fill: '#333', fontSize: 16 },
      { text: '2024年度', fill: '#1890ff', fontSize: 14 },
      { text: ' 报告', fill: '#333', fontSize: 16 }
    ]
  }
}
```

## 带图标的标题

```javascript
title: {
  visible: true,
  text: '📊 数据概览',
  textStyle: {
    fontSize: 18
  }
}

// 或使用图片
title: {
  visible: true,
  text: {
    type: 'rich',
    text: [
      {
        type: 'image',
        image: 'path/to/icon.png',
        width: 20,
        height: 20
      },
      { text: ' 图表标题', fill: '#333' }
    ]
  }
}
```

## 交互配置

```javascript
title: {
  visible: true,
  text: '可点击的标题',
  
  // 样式状态
  textStyle: {
    fill: '#1890ff',
    cursor: 'pointer'
  }
}

// 然后监听事件
vchart.on('click', { type: 'title' }, (params) => {
  console.log('标题被点击');
});
```

## 完整示例

```javascript
title: {
  visible: true,
  text: '2024年度销售数据分析',
  subtext: '数据来源：销售管理系统 | 更新时间：2024-12-31',
  
  orient: 'top',
  align: 'left',
  
  padding: {
    top: 10,
    bottom: 20,
    left: 20
  },
  
  textStyle: {
    fontSize: 20,
    fontWeight: 'bold',
    fill: '#1a1a1a',
    fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif'
  },
  
  subtextStyle: {
    fontSize: 12,
    fill: '#999',
    fontWeight: 'normal'
  }
}
```

## 动态标题

通过更新 spec 实现：

```javascript
// 初始配置
const spec = {
  title: {
    visible: true,
    text: '初始标题'
  },
  // ...
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();

// 更新标题
vchart.updateSpec({
  ...spec,
  title: {
    visible: true,
    text: '更新后的标题'
  }
});
```
