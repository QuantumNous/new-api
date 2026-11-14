---
category: examples
group: react attributes
title: 使用react渲染漏斗图标签
keywords: funnelChart,composition,trend,triangle
order: 5-0
cover: /vchart/preview/funnel-react-attributes-1.11.0.png
option: funnelChart
---

# 基础漏斗图

漏斗图，形如“漏斗”，用于单流程分析，在开始和结束之间由 N 个流程环节组成，通常这 N 个流程环节，有逻辑上的顺序关系。

## 关键配置

- `funnel.style.react` 指定漏斗图中梯形的 react 属性，渲染自定义的 react 组件

## 代码演示

```javascript livedemo template=react-vchart
const root = document.getElementById(CONTAINER_ID);
const { VChart, FunnelChart, Pie, Legend } = ReactVChart;
const { useState, useRef, useEffect, useCallback } = React;

const data = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' },
  { type: 'calcium', value: '3.63' },
  { type: 'sodium', value: '2.83' },
  { type: 'potassium', value: '2.59' },
  { type: 'others', value: '3.5' }
];

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const renderFunnelLabel = useCallback(datum => {
    return {
      element: <button style={{ color: 'black' }}>{datum.name}</button>,
      anchorType: 'middle',
      pointerEvents: 'all',
      style: 'transform:translate(-50%, -50%);'
    };
  }, []);

  return (
    <FunnelChart
      ref={chartRef}
      options={{
        // 注意，在实际使用场景中，需要自己引入：`import ReactDOM from 'react-dom/client';`
        ReactDOM: ReactDom
      }}
      spec={{
        type: 'funnel',
        categoryField: 'name',
        valueField: 'value',
        data: [
          {
            id: 'funnel',
            values: [
              {
                value: 100,
                name: 'Step1'
              },
              {
                value: 80,
                name: 'Step2'
              },
              {
                value: 60,
                name: 'Step3'
              },
              {
                value: 40,
                name: 'Step4'
              },
              {
                value: 20,
                name: 'Step5'
              }
            ]
          }
        ],
        funnel: {
          style: {
            react: renderFunnelLabel
          }
        },

        legends: {
          visible: true,
          orient: 'bottom'
        }
      }}
    />
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## 相关教程

[漏斗图](link)
