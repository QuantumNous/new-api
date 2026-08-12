---
category: examples
group: funnel chart
title: 使用react渲染漏斗图标签
keywords: funnelChart,composition,trend,triangle
order: 5-0
cover: /vchart/preview/funnel-react-attributes-1.11.0.png
option: funnelChart
---

# Basic Funnel Chart

A funnel chart, shaped like a "funnel," is used for single-process analysis, consisting of N process stages between the start and the end, usually with a logical sequence among these N stages.

## Key Configuration

- `funnel.style.react` specifies the react attributes for the trapezoids in the funnel chart, rendering custom react components

## Code Demonstration

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
