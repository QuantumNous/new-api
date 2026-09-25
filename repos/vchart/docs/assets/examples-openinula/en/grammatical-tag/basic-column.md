---
category: examples
group: grammatical-tag
title: Basic Column Chart
keywords: barChart, comparison, distribution, rank, rectangle
order: 0-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/basic-column.png
option: barChart
---

# Basic Column Chart

The most basic column chart requires a categorical variable and a numerical variable. In this example, we created a simple column chart to display a week's sales data, where the categorical variable is `month` and the numerical variable is `sales`.

## Key option

- `type: bar` attribute declares it as a column chart
- `xField` attribute declares the categorical or temporal field
- `yField` attribute declares the numerical field

## Demo source

```javascript livedemo template=openinula-vchart
const getData = () =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(time => ({
    time,
    value: Math.random() * 40
  }));

const root = document.getElementById(CONTAINER_ID);
const { VChart, BarChart, Bar } = InulaVChart;
const { useState, useRef, useEffect } = Inula;

const Card = () => {
  const [data, setData] = useState(getData());
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleSwitchData = () => {
    setData(getData());
  };

  const handleBarClick = params => {
    console.log(params);
  };

  return (
    <div>
      <BarChart ref={chartRef} data={[{ id: 'id0', values: data }]}>
        <Bar
          xField="time"
          yField="value"
          bar={{
            state: {
              hover: {
                fill: 'black'
              }
            }
          }}
          onClick={handleBarClick}
        />
      </BarChart>
      <button
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, 0)' }}
        onClick={handleSwitchData}
      >
        Switch Data
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

[Column Chart](link)
