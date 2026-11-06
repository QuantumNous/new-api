---
category: examples
group: CirclePacking
title: 基础 CirclePacking 图
keywords: circlePacking,composition,circle,relationShip
order: 20-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/circle-packing-chart/basic-circle-packing.png
option: circlePackingChart
---

# 基础 CirclePacking 图

该例子展示了 CirclePacking 图的基础用法。

## 关键配置

- `categoryField` 属性声明为分类字段
- `valueField` 属性声明为数值字段
- `circlePacking` Circle 图元配置
- `label` 标签图元配置

## 代码演示

```javascript livedemo
const data = [
  {
    name: 'root',
    children: [
      {
        name: 'Country A',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country B',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      },
      {
        name: 'Country C',
        children: [
          {
            name: 'Region1',
            children: [
              { name: 'Office Supplies', value: 824 },
              { name: 'Furniture', value: 920 },
              { name: 'Electronic equipment', value: 936 }
            ]
          },
          {
            name: 'Region2',
            children: [
              { name: 'Office Supplies', value: 1270 },
              { name: 'Furniture', value: 1399 },
              { name: 'Electronic equipment', value: 1466 }
            ]
          },
          {
            name: 'Region3',
            children: [
              { name: 'Office Supplies', value: 1408 },
              { name: 'Furniture', value: 1676 },
              { name: 'Electronic equipment', value: 1559 }
            ]
          },
          {
            name: 'Region4',
            children: [
              { name: 'Office Supplies', value: 745 },
              { name: 'Furniture', value: 919 },
              { name: 'Electronic equipment', value: 781 }
            ]
          },
          {
            name: 'Region5',
            children: [
              { name: 'Office Supplies', value: 267 },
              { name: 'Furniture', value: 316 },
              { name: 'Electronic equipment', value: 230 }
            ]
          },
          {
            name: 'Region6',
            children: [
              { name: 'Office Supplies', value: 347 },
              { name: 'Furniture', value: 501 },
              { name: 'Electronic equipment', value: 453 }
            ]
          }
        ]
      }
    ]
  }
];

const spec = {
  data: [
    {
      id: 'data',
      values: data
    }
  ],
  type: 'circlePacking',
  categoryField: 'name',
  valueField: 'value',
  drill: true,
  circlePacking: {
    style: {
      fillOpacity: d => (d.isLeaf ? 0.75 : 0.25)
    }
  },
  layoutPadding: 5,
  label: {
    style: {
      fontSize: 10,
      visible: d => {
        return d.depth === 1;
      }
    }
  },
  animationEnter: {
    easing: 'cubicInOut'
  },
  animationExit: {
    easing: 'cubicInOut'
  },
  animationUpdate: {
    easing: 'cubicInOut'
  },
  tooltip: {
    mark: {
      title: {
        value: val => {
          return val?.datum?.map(data => data.name).join(' / ');
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window.vchart = vchart;
```

## 相关教程

[CirclePacking](link)
