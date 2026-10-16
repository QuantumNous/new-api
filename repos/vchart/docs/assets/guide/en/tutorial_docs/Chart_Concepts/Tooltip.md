# Tooltip

Tooltip is the additional information displayed on different elements of the VChart chart, which is displayed through mouse hover operation. This tutorial mainly explains the related concepts and components of the tooltip. For more detailed configuration and examples of the components, please see the [Configuration Documentation](../../../option) and [Example](../../../example) pages.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a212.png" alt="tooltip">
</div>

## Composition of Tooltip

In VChart charts, Tooltip mainly consists of two parts:

1. Title (`title`): Displays the data category or other related information that the mouse is currently hovering over.
2. Content (`content`): Displays detailed data and its attribute information that the mouse is currently hovering over.

In VChart, we provide two types of tooltips according to the displayed data, which are mark tooltip (`'mark'`) and dimension tooltip (`'dimension'`). The mark ('mark') refers to the individual data corresponding to the graphic (such as a small square in the stacked column chart below). The 'dimension' refers to the set of data corresponding to the dimension value (such as x value) in the area where the mouse is currently located (such as the set of data stacked together in the stacked column chart below):

![Tooltip Content Types](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a11.png)

## Style Configuration

By configuring the `tooltip.style` property, we can style the tooltip. The following code example shows common style configurations for the tooltip panel, such as adjusting the background color, rounded corners, and border shadow.

```ts
tooltip: {
    style: {
      panel: {
        /** Background color */
        backgroundColor: 'rgba(24,144,255, 0.1)',
        /** tooltip border */
        border: {
          color: '#6690F2',
          width: 2,
          /** Rounded corners */
          radius: 4
        },
        /** tooltip shadow */
        shadow: {
          blur: 10,
          spread: 2,
          color: '#6690F2'
        }
      }
    }
  }
```

![Tooltip Style Configuration Result Graph](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a213.png)

## Formatting

### Title Formatting

Sometimes we need to display the tooltip title in a specific format. We can configure the `title.value` property in the corresponding tooltip type. If the property is configured as a string, it will be displayed as the corresponding constant text. It can also be configured as a function callback: `(datum: Datum) => string;` where datum is the default data item corresponding to the current tooltip line.

Title formatting example:

```ts
{
  tooltip: {
    // Configure the title content of the mark graphic
    mark: {
      title: {
        value: 'Title'
      }
    },
    // Configure the title content of the dimension item
    dimension: {
      title: {
        value: datum => datum.value
      }
    },
  }
}
```

### 2. Content Formatting

In addition to the title, we can also format the content of the tooltip. Similar to title formatting, we can configure the `content` property for the corresponding tooltip type. Each content of the tooltip consists of the following parts:

- `shape`: The shape of the data item.
- `key`: The name of the data item.
- `value`: The value of the data item.

When we need to format the content, we can configure the `key`, `value` properties. If they are configured as strings, they will be displayed as corresponding constant texts. It can also be configured as a function callback: `(datum: Datum) => string;` where datum is the default data item corresponding to the current tooltip line.

Content formatting example:

```ts
{
  tooltip: {
    // Configure the content of the mark graphic
    mark: {
      content: {
        key: 'Value',
        value: datum => datum.value
      }
    },
    // Configure the content of the dimension item
    dimension: {
      content: {
        key: datum => datum.type,
        value: datum => datum.value
      }
    },
  }
}
```

## Customization

According to the chart and business requirements, we can further customize the tooltip. For details, please refer to the [`setTooltipHandler`](/vchart/api/API/vchart) method.

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
    interactive: false
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
      values: [],
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

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
window['tooltipChart'] = tooltipChart;
```
