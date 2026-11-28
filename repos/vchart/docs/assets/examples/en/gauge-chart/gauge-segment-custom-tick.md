---
category: examples
group: gauge
title: Gauge Chart with Segment Ticks and Target Value
keywords: gauge,comparison,circle
order: 15-7
cover: /vchart/preview/gauge-segment-custom-tick_1.4.2.png
option: gaugeChart
---

# Gauge Chart with Segment Ticks and Target Value

## Key option

- `categoryField`,`valueField` Properties are used to specify data categories and pointer angle fields, respectively
- `innerRadius`,`outerRadius` Property is used to specify the inner and outer radii of the dashboard
- `startAngle`,`endAngle` Properties are used to specify the start and end angles of the dashboard
- `gauge`Properties can be configured[Background panel series for gauge chart](../../option/gaugeChart#gauge)

## Demo source

```javascript livedemo
// common parameters, same as spec configuration
const valueField = 'value';
const minValue = 0;
const maxValue = 1;
const outerRadius = 0.8;
const innerRadius = 0.5;
const startAngle = -210;
const endAngle = 30;
const tickSize = 6;
const gaugeDataIndex = 1;

// label configuration
const labelSpace = 4;
const labelBgPadding = {
  left: 3,
  right: 3,
  top: 2,
  bottom: 2
};

// public methods
const DEFAULT_ABSOLUTE_TOLERATE = 1e-10;
const DEFAULT_RELATIVE_TOLERATE = 1e-10;
const isNumberClose = (a, b, relTol = DEFAULT_RELATIVE_TOLERATE, absTol = DEFAULT_ABSOLUTE_TOLERATE) => {
  const abs = absTol;
  const rel = relTol * Math.max(a, b);
  return Math.abs(a - b) <= Math.max(abs, rel);
};
const degreeToRadian = degree => (degree / 180) * Math.PI;
const getTextAlign = vector => {
  let align = 'center';
  if (isNumberClose(vector[0], 0)) {
    if (isNumberClose(vector[1], 0)) {
      if (Object.is(vector[1], -0)) {
        align = 'start';
      } else if (Object.is(vector[0], -0)) {
        align = 'end';
      }
    } else {
      align = 'center';
    }
  } else if (vector[0] > 0) {
    align = 'start';
  } else if (vector[0] < 0) {
    align = 'end';
  }
  return align;
};
const getTextBaseline = vector => {
  let base = 'middle';
  if (isNumberClose(vector[1], 0)) {
    base = 'middle';
  } else if (vector[1] > 0 && vector[1] > Math.abs(vector[0])) {
    base = 'top';
  } else if (vector[1] < 0 && Math.abs(vector[1]) > Math.abs(vector[0])) {
    base = 'bottom';
  }
  return base;
};

// business side methods
const getAngle = value =>
  degreeToRadian(((value - minValue) / (maxValue - minValue)) * (endAngle - startAngle) + startAngle);
const getTickPoint = (value, offsetRadius, ctx) => {
  if (!ctx) {
    return [0, 0];
  }
  const { getCenter, getLayoutRadius } = ctx;
  const layoutRadius = getLayoutRadius();
  const center = getCenter();
  const angle = getAngle(value);
  const radius = innerRadius * layoutRadius + offsetRadius;
  const x = center.x + radius * Math.cos(angle);
  const y = center.y + radius * Math.sin(angle);
  return [x, y];
};
const getTickVector = (value, offsetRadius, ctx) => {
  const start = getTickPoint(value, 0, ctx);
  const end = getTickPoint(value, offsetRadius, ctx);
  return [end[0] - start[0], end[1] - start[1]];
};
const labelFormatMethod = value => value.toString();

// methods for constructing custom marks
const getSimpleTickMark = (value, style) => {
  let getValue = datum => value;
  let dataIndex;
  if (typeof value === 'function') {
    getValue = datum => value(datum);
    dataIndex = gaugeDataIndex;
  }
  return {
    type: 'rule',
    visible: true,
    dataIndex,
    style: {
      x: (datum, ctx) => getTickPoint(getValue(datum), 0, ctx)[0],
      y: (datum, ctx) => getTickPoint(getValue(datum), 0, ctx)[1],
      x1: (datum, ctx) => getTickPoint(getValue(datum), -tickSize, ctx)[0],
      y1: (datum, ctx) => getTickPoint(getValue(datum), -tickSize, ctx)[1],
      ...style
    }
  };
};
const getSimpleLabelMark = (value, style) => {
  let getValue = datum => value;
  let dataIndex;
  if (typeof value === 'function') {
    getValue = value;
    dataIndex = gaugeDataIndex;
  }
  return {
    type: 'text',
    visible: true,
    dataIndex,
    style: {
      x: (datum, ctx) => getTickPoint(getValue(datum), -tickSize - labelSpace, ctx)[0],
      y: (datum, ctx) => getTickPoint(getValue(datum), -tickSize - labelSpace, ctx)[1],
      text: datum => labelFormatMethod(getValue(datum)),
      textAlign: (datum, ctx) => getTextAlign(getTickVector(getValue(datum), -tickSize - labelSpace, ctx)),
      textBaseline: (datum, ctx) => getTextBaseline(getTickVector(getValue(datum), -tickSize - labelSpace, ctx)),
      ...style
    }
  };
};
const getSimpleLabelBgMark = (value, style, textStyle) => {
  let getValue = datum => value;
  let dataIndex;
  if (typeof value === 'function') {
    getValue = datum => value(datum);
    dataIndex = gaugeDataIndex;
  }
  const label = getSimpleLabelMark(getValue, textStyle);
  const {
    style: { x: getX, y: getY, text: getText, textAlign: getTextAlign, textBaseline: getTextBaseline }
  } = label;
  const getBgSize = (datum, ctx) => {
    const text = getText(datum, ctx);
    const textAlign = getTextAlign(datum, ctx);
    const textBaseline = getTextBaseline(datum, ctx);
    const size = VChart.Utils.measureText(text, {
      ...label.style,
      textAlign,
      textBaseline
    });
    return {
      width: size.width + labelBgPadding.left + labelBgPadding.right,
      height: size.height + labelBgPadding.top + labelBgPadding.bottom
    };
  };
  return {
    type: 'rect',
    visible: true,
    dataIndex,
    style: {
      x: (datum, ctx) => {
        const { width } = getBgSize(datum, ctx);
        const textAlign = getTextAlign(datum, ctx);
        const x = getX(datum, ctx);
        if (textAlign === 'end') {
          return x - width + labelBgPadding.right;
        } else if (textAlign === 'center') {
          return x - (width - labelBgPadding.left - labelBgPadding.right) / 2 - labelBgPadding.left;
        }
        return x - labelBgPadding.left;
      },
      y: (datum, ctx) => {
        const { height } = getBgSize(datum, ctx);
        const textBaseline = getTextBaseline(datum, ctx);
        const y = getY(datum, ctx);
        if (textBaseline === 'bottom') {
          return y - height + labelBgPadding.bottom;
        } else if (textBaseline === 'middle') {
          return y - (height - labelBgPadding.top - labelBgPadding.bottom) / 2 - labelBgPadding.top;
        }
        return y - labelBgPadding.top;
      },
      width: (datum, ctx) => getBgSize(datum, ctx).width,
      height: (datum, ctx) => getBgSize(datum, ctx).height,
      ...style
    }
  };
};

const getTicks = style => [getSimpleTickMark(minValue, style), getSimpleTickMark(datum => datum[valueField], style)];

const getLabels = style => [getSimpleLabelMark(minValue, style), getSimpleLabelMark(datum => datum[valueField], style)];

const getTargetMarks = (value, tickStyle, textStyle, rectStyle) => [
  getSimpleLabelBgMark(value, rectStyle, textStyle),
  getSimpleTickMark(value, tickStyle),
  getSimpleLabelMark(value, textStyle)
];

const spec = {
  type: 'gauge',
  data: [
    {
      id: 'pointer',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    },
    {
      id: 'segment',
      values: [
        {
          type: 'Level 1',
          color: '#07A35A',
          value: 0.3
        },
        {
          type: 'Level 2',
          color: '#FFC528',
          value: 0.5
        },
        {
          type: 'Level 3',
          color: '#E33232',
          value: 1
        }
      ]
    }
  ],
  gauge: {
    type: 'gauge',
    dataIndex: gaugeDataIndex,
    categoryField: 'type',
    valueField,
    seriesField: 'type',
    segment: {
      style: {
        fill: datum => datum['color']
      }
    },
    label: {
      visible: true,
      position: 'inside-outer',
      offsetRadius: 15,
      style: {
        text: datum => datum['type']
      }
    }
  },
  pointer: {
    style: {
      fill: '#666666'
    }
  },
  categoryField: 'type',
  valueField: 'value',
  outerRadius,
  innerRadius,
  startAngle,
  endAngle,
  axes: [{ type: 'linear', orient: 'angle', label: { visible: false } }],
  extensionMark: [
    // 添加区间 tick
    ...getTicks({
      stroke: 'blue',
      lineWidth: 2
    }),
    // 添加区间 tick 标签
    ...getLabels({}),
    // 添加目标值高亮组
    ...getTargetMarks(
      0.38,
      {
        stroke: 'red',
        lineWidth: 2
      },
      {
        fill: 'white',
        fontSize: 14
      },
      {
        fill: 'orange',
        cornerRadius: 3
      }
    )
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Gauge chart](link)
