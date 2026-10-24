---
category: examples
group: customMark
title: 饼图自定义 mark
order: 40-3
cover: /vchart/preview/custom-pie-extension.png
option: pieChart#extensionMark
---

# 饼图自定义 mark

## 关键配置

- `extensionMark` 属性配置自定义 arc 图元
  - `extensionMark.type` 属性配置图元的类型
  - `extensionMark.dataId` 属性配置图元的数据来源
  - `extensionMark.style` 属性配置图元的样式

## 代码演示

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  innerRadius: 0.68,
  outerRadius: 0.75,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content',
    textStyle: {
      fill: '#eee'
    }
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: false
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  },
  background: 'rgba(0,0,0,1)',
  extensionMark: [
    {
      name: 'arc_inner_shadow',
      type: 'arc',
      dataId: 'id0',
      style: {
        interactive: false,
        startAngle: (...params) => {
          return params[0]['__VCHART_ARC_START_ANGLE'];
        },
        endAngle: (...params) => {
          return params[0]['__VCHART_ARC_END_ANGLE'];
        },
        innerRadius: (...params) => {
          return params[1].getLayoutRadius() * 0.68 - 30;
        },
        outerRadius: (...params) => {
          return params[1].getLayoutRadius() * 0.68;
        },
        fillOpacity: 0.3,
        fill: (...params) => {
          return params[1].seriesColor(params[0]['type']);
        },
        visible: true,
        x: (...params) => {
          return params[1].getCenter().x();
        },
        y: (...params) => {
          return params[1].getCenter().y();
        }
      }
    },
    {
      name: 'arc_inner',
      type: 'symbol',
      // dataId: 'id0',
      style: {
        interactive: false,
        size: (...params) => {
          console.log('params', params);
          return params[1].getLayoutRadius() * 2 * 0.68 - 100;
        },
        fillOpacity: 0,
        lineWidth: 1,
        strokeOpacity: 0.5,
        stroke: {
          gradient: 'conical',
          startAngle: 0,
          endAngle: Math.PI * 2,
          stops: [
            {
              offset: 0,
              color: '#FFF',
              opacity: 0
            },
            {
              offset: 1,
              color: '#FFF',
              opacity: 1
            }
          ]
        },
        visible: true,
        x: (...params) => {
          return params[1].getCenter().x();
        },
        y: (...params) => {
          return params[1].getCenter().y();
        }
      }
    },
    {
      name: 'arc_outter',
      type: 'symbol',
      // dataId: 'id0',
      style: {
        interactive: false,
        size: (...params) => {
          console.log('params-outer', params, params[1].getLayoutRadius());
          return params[1].getLayoutRadius() * 2 * 0.75 + 50;
        },
        fillOpacity: 0,
        lineWidth: 1,
        strokeOpacity: 0.5,
        stroke: {
          gradient: 'conical',
          startAngle: 0,
          endAngle: Math.PI * 2,
          stops: [
            {
              offset: 0,
              color: '#FFF',
              opacity: 0
            },
            {
              offset: 1,
              color: '#FFF',
              opacity: 1
            }
          ]
        },
        visible: true,
        x: (...params) => {
          return params[1].getCenter().x();
        },
        y: (...params) => {
          return params[1].getCenter().y();
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[自定义 mark](link)
