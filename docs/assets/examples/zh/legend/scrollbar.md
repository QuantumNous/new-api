---
category: demo
group: legend
title: 图例使用滚动条翻页
keywords: pieChart,legend,circle,comparison,proportion,composition
order: 27-5
cover: /vchart/preview/legend-scrollbar_1.10.3.png
option: pieChart#legends
---

# 图例使用滚动条翻页

在离散图例中，当图例项数据特别大的时候，还可以使用滚动条实现翻页效果

## 关键配置

- `data` 配置图例项的数据
- `legends.pager.scrollbar` 设置翻页类型为滚动条

## 代码演示

```javascript livedemo
const data = [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
];
let totalValue = 0;
data.forEach(obj => (totalValue += obj.value));
const map = {};
data.forEach(obj => {
  map[obj.category] = `${((obj.value / totalValue) * 100).toFixed(2)}%`;
});

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  categoryField: 'category',
  valueField: 'value',
  legends: {
    visible: true,
    layout: 'vertical',
    orient: 'right',
    data: items => {
      return new Array(10).fill(0).reduce((res, entry, idx) => {
        items.forEach(item => {
          res.push({
            ...item,
            label: idx === 0 ? item.label : `${item.label}-${idx}`
          });
        });

        return res;
      }, []);
    },
    item: {
      value: {
        alignRight: true,
        style: {
          fill: '#333',
          fillOpacity: 0.8,
          fontSize: 10
        },
        state: {
          unselected: {
            fill: '#d8d8d8'
          }
        }
      }
    },
    pager: {
      type: 'scrollbar',
      railStyle: {
        fill: '#ccc',
        cornerRadius: 5
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.on('legendItemHover', e => {
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => d.type !== hoveredName
      }
    });
  }
});
vchart.on('legendItemUnHover', e => {
  vchart.updateState({
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
