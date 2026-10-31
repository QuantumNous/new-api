---
category: demo
group: tooltip
title: Custom tooltip handler
keywords: tooltip
order: 26-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/7b82fb013e7c6319c065b3d03.png
option: roseChart#tooltip
---

# Custom tooltip handler

When the configuration options cannot meet the display requirements of the tooltip, we also provide the ability to customize the tooltip.

Note:

- When a custom tooltip handler is set for the chart, the built-in tooltip will no longer work.
- VChart does not perceive and manage the rendering of custom tooltips. Please implement the tooltip rendering according to your needs, including **processing raw data**, **tooltip content design**, and **creating components and setting styles according to the project environment**.
- When the chart is deleted, the `release` function of the current tooltip handler will be called, please delete it as needed.
- Since the custom tooltip handler will override the built-in tooltip logic, **some tooltip configuration items in the chart spec will no longer work**.

## Demo source

```javascript livedemo
const data = [
  { type: 'rail', value: 31.8, month: 'January' },
  { type: 'highway', value: 39.2, month: 'January' },
  { type: 'civil aviation', value: 24.1, month: 'January' },
  { type: 'rail', value: 46.4, month: 'February' },
  { type: 'highway', value: 38, month: 'February' },
  { type: 'civil aviation', value: 22.3, month: 'February' },
  { type: 'rail', value: 30.3, month: 'March' },
  { type: 'highway', value: 30.9, month: 'March' },
  { type: 'civil aviation', value: 23.4, month: 'March' },
  { type: 'rail', value: 60.8, month: 'April' },
  { type: 'highway', value: 26.8, month: 'April' },
  { type: 'civil aviation', value: 24.5, month: 'April' },
  { type: 'rail', value: 31.7, month: 'May' },
  { type: 'highway', value: 26.4, month: 'May' },
  { type: 'civil aviation', value: 27, month: 'May' },
  { type: 'rail', value: 38.7, month: 'June' },
  { type: 'highway', value: 36.7, month: 'June' },
  { type: 'civil aviation', value: 33.4, month: 'June' },
  { type: 'rail', value: 25.3, month: 'July' },
  { type: 'highway', value: 34.7, month: 'July' },
  { type: 'civil aviation', value: 28.2, month: 'July' },
  { type: 'rail', value: 45.3, month: 'August' },
  { type: 'highway', value: 25.3, month: 'August' },
  { type: 'civil aviation', value: 30.8, month: 'August' },
  { type: 'rail', value: 26.8, month: 'September' },
  { type: 'highway', value: 29.4, month: 'September' },
  { type: 'civil aviation', value: 20.9, month: 'September' },
  { type: 'rail', value: 39.8, month: 'October' },
  { type: 'highway', value: 38.5, month: 'October' },
  { type: 'civil aviation', value: 39, month: 'October' },
  { type: 'rail', value: 38.3, month: 'November' },
  { type: 'highway', value: 23.8, month: 'November' },
  { type: 'civil aviation', value: 29.4, month: 'November' },
  { type: 'rail', value: 62.8, month: 'December' },
  { type: 'highway', value: 35.8, month: 'December' },
  { type: 'civil aviation', value: 35.2, month: 'December' }
];
const dataFields = {
  month: {
    lockStatisticsByDomain: true,
    domain: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ]
  },
  type: {
    lockStatisticsByDomain: true,
    domain: ['rail', 'highway', 'civil aviation']
  }
};
const spec = {
  type: 'rose',
  data: [
    {
      id: 'id0',
      values: data,
      fields: dataFields
    }
  ],
  padding: {
    top: 30
  },
  radius: 0.8,
  innerRadius: 0,
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  stack: true,
  rose: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  legends: {
    visible: true,
    orient: 'top',
    interactive: true
  },
  axes: [
    {
      orient: 'radius',
      visible: true,
      tick: { tickCount: 3 },
      grid: { visible: true, style: { lineDash: [0] } },
      max: 150
    },
    {
      orient: 'angle',
      visible: true,
      domainLine: { visible: true, smooth: false },
      grid: { visible: true, smooth: false },
      label: {
        visible: true,
        style: {
          fill: '#000'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

const tooltipChartSpec = {
  type: 'pie',
  padding: 2,
  background: 'transparent',
  data: [
    {
      id: 'tooltipData',
      values: [
        { type: 'rail', value: 31.8, month: 'January' },
        { type: 'highway', value: 39.2, month: 'January' }
      ],
      fields: dataFields
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  radius: 0.15,
  innerRadius: 0.11,
  pie: {
    style: {
      stroke: 'white',
      fillOpacity: 0.8,
      lineWidth: 2
    }
  },
  label: {
    visible: true,
    position: 'outside',
    style: {
      stroke: 'white',
      lineWidth: 4,
      text: datum => [datum['type'], `(${datum['value']}, ${datum['month']})`]
    }
  }
};

function initTooltip() {
  const createElement = (parentEl, tag, classList, style, id) => {
    const element = document.createElement(tag);
    if (classList) {
      element.classList.add(...classList);
    }
    if (style) {
      Object.keys(style).forEach(key => {
        element.style[key] = style[key];
      });
    }
    if (id) {
      element.id = id;
    }
    parentEl.appendChild(element);
    return element;
  };

  const tooltipContainer = createElement(
    document.getElementById(CONTAINER_ID),
    'div',
    [],
    {
      position: 'absolute',
      boxSizing: 'border-box',
      width: '100px',
      height: '100px',
      background:
        'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0) 26px, rgba(255, 255, 255, 0.65) 26px, rgba(255, 255, 255, 0.65) 100%)',
      //backdropFilter: 'blur(2px)',
      borderRadius: '50%',
      boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 12px 0px',
      visibility: 'hidden',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      top: 0,
      left: 0
    },
    'tooltip'
  );
  const tooltipChartContainer = createElement(
    tooltipContainer,
    'div',
    [],
    {
      width: '500px',
      height: '500px',
      transform: 'translate(-50%, -50%)',
      margin: '50%'
    },
    'tooltip-chart'
  );

  const tooltipChart = new VChart(tooltipChartSpec, { dom: 'tooltip-chart' });
  tooltipChart.renderSync();
  return tooltipChart;
}

const tooltipChart = initTooltip();
vchart.setTooltipHandler({
  showTooltip: (activeType, tooltipData, params) => {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.left = params.event.x + 'px';
    tooltip.style.top = params.event.y + 'px';
    if (params.changePositionOnly) {
      return;
    }
    let data = [];
    if (activeType === 'dimension') {
      data = tooltipData[0]?.data[0]?.datum ?? [];
    } else if (activeType === 'mark') {
      data = tooltipData[0]?.datum ?? [];
    }
    tooltipChart.updateData(
      'tooltipData',
      data.map(({ type, value, month }) => ({ type, value, month }))
    );
    tooltip.style.visibility = 'visible';
  },
  hideTooltip: () => {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.visibility = 'hidden';
  },
  release: () => {
    tooltipChart.release();
    const tooltip = document.getElementById('tooltip');
    tooltip.remove();
  }
});

vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
window['tooltipChart'] = tooltipChart;
```

## Related tutorials

Attach the link to the tutorial or API documentation related to this demo's configuration.
