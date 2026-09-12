---
category: examples
group: usage
title: Set Default Selected Dimension
keywords: lineChart,comparison,trend,line
order: 0-7
cover: /vchart/preview/line-chart-line-default-select_1.8.2.png
option: lineChart
---

# Set Default Selected Dimension

Select specific dimensions by default and highlight crosshair, tooltip, etc.

## Key Configuration

- Use the method `vchart.setDimensionIndex` to set the selected specific dimension data

## Code Demo

```javascript livedemo template=openinula-vchart
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked line chart'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  point: {
    style: {
      size: 0,
      fill: 'white',
      stroke: null,
      lineWidth: 2
    },
    state: {
      dimension_hover: {
        size: 10
      }
    }
  },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }]
};

const root = document.getElementById(CONTAINER_ID);
const { VChart } = InulaVChart;
const { useState, useRef, useEffect } = Inula;

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleSelectDimension = () => {
    if (chartRef.current) {
      chartRef.current.setDimensionIndex('Rouge', {
        showTooltipOption: {
          y: 100
        }
      });
    }
  };

  return (
    <div>
      <VChart ref={chartRef} spec={spec} />
      <button
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, 0)' }}
        onClick={handleSelectDimension}
      >
        Select 'Rouge'
      </button>
    </div>
  );
};

Inula.render(<Card />, root);

// release openinula instance, do not copy
window.customRelease = () => {
  Inula.unmountComponentAtNode(root);
};
```

## Related Tutorials

[Line Chart](link)
