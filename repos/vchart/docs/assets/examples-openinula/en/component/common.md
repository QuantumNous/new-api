---
category: examples
group: component
title: Common Chart With Custom Tooltip
order: 0-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/theme/theme-switch.png
---

# Common Chart With Custom Tooltip

## Live Demo

```javascript livedemo template=openinula-vchart
const root = document.getElementById(CONTAINER_ID);
const { VChart, CommonChart, Bar, Line, Axis, Legend, Tooltip } = InulaVChart;
const { useState, useRef, useEffect } = Inula;

const data0 = [
  {
    time: '2:00',
    value: 8,
    type: 'Douyin'
  },
  {
    time: '4:00',
    value: 9,
    type: 'Douyin'
  },
  {
    time: '6:00',
    value: 11,
    type: 'Douyin'
  },
  {
    time: '8:00',
    value: 14,
    type: 'Douyin'
  },
  {
    time: '10:00',
    value: 16,
    type: 'Douyin'
  },
  {
    time: '12:00',
    value: 17,
    type: 'Douyin'
  },
  {
    time: '14:00',
    value: 17,
    type: 'Douyin'
  },
  {
    time: '16:00',
    value: 16,
    type: 'Douyin'
  },
  {
    time: '18:00',
    value: 15,
    type: 'Douyin'
  },

  {
    time: '2:00',
    value: 7,
    type: 'Bilibili'
  },
  {
    time: '4:00',
    value: 8,
    type: 'Bilibili'
  },
  {
    time: '6:00',
    value: 9,
    type: 'Bilibili'
  },
  {
    time: '8:00',
    value: 10,
    type: 'Bilibili'
  },
  {
    time: '10:00',
    value: 9,
    type: 'Bilibili'
  },
  {
    time: '12:00',
    value: 12,
    type: 'Bilibili'
  },
  {
    time: '14:00',
    value: 14,
    type: 'Bilibili'
  },
  {
    time: '16:00',
    value: 12,
    type: 'Bilibili'
  },
  {
    time: '18:00',
    value: 14,
    type: 'Bilibili'
  }
];

const data1 = [
  {
    time: '2:00',
    value: 15,
    type: 'Total'
  },
  {
    time: '4:00',
    value: 17,
    type: 'Total'
  },
  {
    time: '6:00',
    value: 20,
    type: 'Total'
  },
  {
    time: '8:00',
    value: 24,
    type: 'Total'
  },
  {
    time: '10:00',
    value: 25,
    type: 'Total'
  },
  {
    time: '12:00',
    value: 29,
    type: 'Total'
  },
  {
    time: '14:00',
    value: 31,
    type: 'Total'
  },
  {
    time: '16:00',
    value: 28,
    type: 'Total'
  },
  {
    time: '18:00',
    value: 29,
    type: 'Total'
  }
];

const CustomTooltip = ({ actualTooltip }) => {
  return (
    <div style={{ textAlign: 'center', marginTop: 5 }}>
      <button>🔥 {actualTooltip.title.value}</button>
    </div>
  );
};

const Card = () => {
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleLegendItemClick = params => {
    console.log(params);
  };

  return (
    <CommonChart ref={chartRef} onLegendItemClick={handleLegendItemClick}>
      <Bar
        data={{
          id: 'id0',
          values: data0
        }}
        xField={['time', 'type']}
        yField="value"
        seriesField="type"
      />
      <Line
        data={{
          id: 'id1',
          values: data1
        }}
        xField="time"
        yField="value"
        seriesField="type"
      />
      <Legend visible orient="right" />
      <Axis orient="bottom" type="band" />
      <Axis orient="left" type="linear" />
      <Tooltip reserveDefaultTooltip enterable>
        <CustomTooltip />
      </Tooltip>
    </CommonChart>
  );
};

Inula.render(<Card />, root);

// release openinula instance, do not copy
window.customRelease = () => {
  Inula.unmountComponentAtNode(root);
};
```

## Related Tutorials

[Tooltip](link)
