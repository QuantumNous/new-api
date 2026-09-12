---
category: examples
group: sankey chart
title: 桑基图自定义html渲染节点
keywords: sankey,composition,distribution,relationship,comparison,flow
order: 12-9
cover: /vchart/preview/sankey-chart-customized-node-1.11.0.png
option: sankeyChart
---

# 桑基图自定义 html 渲染节点

桑基图可以通过相应的配置，指定节点的宽度、高度，结合 vrender 拓展属性`html` 实现指标卡桑基图

## 关键配置

- `dropIsolatedNode` 是否抛弃孤点，也就是没有来源去向的点
- `nodeWidth` 指定节点的宽度
- `equalNodeHeight` 指定节点的高度为均匀计算，不按照数据的值进行映射
- `linkOverlap` 指定边的布局方式为重叠布局，布局对齐点为中心点
- `node.style.html` 设置节点渲染的 html 内容

## 代码演示

```javascript livedemo
const spec = {
  type: 'sankey',
  data: [
    {
      id: 'sankeyData',
      values: [
        {
          links: [
            {
              source: '机会人群',
              target: '高潜用户',
              value: 199999
            },
            {
              source: '高潜用户0',
              target: '高潜用户',
              value: 299999
            },
            {
              source: '首课新单',
              target: '高潜用户',
              value: 399999
            },
            {
              source: '首课新单',
              target: '复购忠诚',
              value: 499999
            },
            {
              source: '副购忠诚',
              target: '高潜用户',
              value: 599999
            },
            {
              source: '其他',
              value: 199999
            },
            {
              target: '首单新客',
              value: 999
            }
          ]
        }
      ]
    }
  ],
  dataId: 'sankeyData',
  categoryField: 'name',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',
  // nodeAlign: 'justify',

  dropIsolatedNode: false,
  nodeGap: 2,
  nodeWidth: 200,

  // nodeHeight: 100,
  equalNodeHeight: true,
  linkOverlap: 'center',

  title: {
    text: 'How energy is converted or transmitted before being consumed or lost',
    subtext: 'Data: Department of Energy & Climate Change via Tom Counsell',
    subtextStyle: {
      fontSize: 12
    }
  },
  label: {
    visible: false,
    style: {
      fontSize: 10
    }
  },
  node: {
    state: {
      hover: {
        stroke: '#333333'
      },
      selected: {
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 0.1
      }
    },
    style: {
      fill: '#1664FF',
      fillOpacity: 0,
      lineWidth: 1,
      stroke: '#1664FF',
      html: (datum, a, c) => {
        const color = '#1664FF';
        const hasSource = datum.targetLinks && datum.targetLinks.length;

        return {
          style: ({ width, height }) => {
            return {
              'border-right': `8px solid ${color}`,
              width: `${width}px`,
              height: `${height}px`,
              background: hasSource ? color : 'transparent'
            };
          },
          dom: `<div style="margin: 4px 0 0 10px;">
              <button style="
              margin:0;
              font-weight:500;
              line-height: 18px;
              font-size:12px;
              color:#646475;
              ">${datum.key}</button>
              <p style="margin:0;font-weight: 700;
              font-size: 20px;
              line-height: 28px;
              color: ${hasSource ? '#fff' : '#1d1d2e'};">${datum.value}</p>
            </div>`
        };
      }
    }
  },
  link: {
    style: {
      fill: '#1664FF'
    },
    state: {
      hover: {
        fillOpacity: 1
      },
      selected: {
        fill: '#1664FF',
        stroke: '',
        lineWidth: 1,
        brighter: 1,
        fillOpacity: 0.2
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, enableHtmlAttribute: true });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[桑基图](link)
