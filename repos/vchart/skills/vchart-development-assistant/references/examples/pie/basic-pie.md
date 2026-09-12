# 基础饼图

## 适用场景
- 展示数据的占比分布
- 部分与整体的关系
- 少量类目（建议不超过7个）的比例对比

## 基础配置

```javascript
const spec = {
  type: 'pie',
  data: [
    {
      id: 'pieData',
      values: [
        { category: '类目A', value: 120 },
        { category: '类目B', value: 85 },
        { category: '类目C', value: 150 },
        { category: '类目D', value: 70 },
        { category: '类目E', value: 200 }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'category'
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 必填配置项

| 配置项 | 类型 | 说明 |
|-------|------|------|
| `type` | `'pie'` | 图表类型 |
| `data` | `Array` | 数据配置 |
| `valueField` | `string` | 数值字段（决定扇区大小） |
| `categoryField` | `string` | 类目字段（决定扇区划分） |

## 常用可选配置

### 扇区样式
```javascript
pie: {
  style: {
    stroke: '#fff',        // 扇区描边
    lineWidth: 2,
    cornerRadius: 4        // 扇区圆角
  }
}
```

### 半径配置
```javascript
outerRadius: 0.8,   // 外半径（相对于容器）
innerRadius: 0,     // 内半径（0为实心饼图）
```

### 数据标签
```javascript
label: {
  visible: true,
  position: 'outside',  // 'outside' | 'inside'
  style: {
    fill: '#333',
    fontSize: 12
  }
}
```

## 环形图（圆环图）

```javascript
const spec = {
  type: 'pie',
  data: [/* 同上 */],
  valueField: 'value',
  categoryField: 'category',
  outerRadius: 0.8,
  innerRadius: 0.5    // 设置内半径即可变成环形图
};
```

### 环形图中心文字

```javascript
indicator: {
  visible: true,
  title: {
    visible: true,
    style: {
      text: '总计',
      fontSize: 14
    }
  },
  content: {
    visible: true,
    style: {
      text: (data) => {
        const total = data.reduce((sum, d) => sum + d.value, 0);
        return total.toString();
      },
      fontSize: 24,
      fontWeight: 'bold'
    }
  }
}
```

## 玫瑰图

半径表示数值大小：

```javascript
const spec = {
  type: 'rose',
  data: [/* 同上 */],
  valueField: 'value',
  categoryField: 'category',
  seriesField: 'category',
  outerRadius: 0.9,
  innerRadius: 0.2
};
```

## 完整示例

```javascript
const spec = {
  type: 'pie',
  data: [
    {
      id: 'pieData',
      values: [
        { browser: 'Chrome', share: 64.5 },
        { browser: 'Safari', share: 18.8 },
        { browser: 'Firefox', share: 4.2 },
        { browser: 'Edge', share: 3.9 },
        { browser: '其他', share: 8.6 }
      ]
    }
  ],
  valueField: 'share',
  categoryField: 'browser',
  outerRadius: 0.8,
  innerRadius: 0.5,
  color: ['#4285F4', '#FF9500', '#FF6B00', '#00A1F1', '#999'],
  pie: {
    style: {
      stroke: '#fff',
      lineWidth: 2
    }
  },
  label: {
    visible: true,
    position: 'outside',
    line: {
      visible: true,
      style: {
        stroke: '#999'
      }
    },
    layout: {
      align: 'labelLine'
    },
    style: {
      fontSize: 12
    },
    formatMethod: (text, datum) => `${datum.browser}: ${datum.share}%`
  },
  indicator: {
    visible: true,
    title: {
      visible: true,
      style: {
        text: '浏览器',
        fontSize: 14,
        fill: '#666'
      }
    },
    content: {
      visible: true,
      style: {
        text: '市场份额',
        fontSize: 12,
        fill: '#999'
      }
    }
  },
  title: {
    visible: true,
    text: '浏览器市场份额'
  },
  legends: {
    visible: true,
    orient: 'right',
    position: 'middle'
  },
  tooltip: {
    mark: {
      content: [
        {
          key: (datum) => datum.browser,
          value: (datum) => `${datum.share}%`
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: 'container' });
vchart.renderSync();
```

## 相关文档
- [饼图配置项](https://www.visactor.io/vchart/option/pieChart)
- [饼图示例](https://www.visactor.io/vchart/example/pie-chart/basic-pie)
