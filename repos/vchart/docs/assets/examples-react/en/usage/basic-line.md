---
category: examples
group: usage
title: Basic line chart
keywords: lineChart,comparison,trend,line
order: 0-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/basic-line.png
option: lineChart
---

# Basic Line Chart

Line charts are constructed by connecting a series of data points to form a trend. Line charts are used to analyze the trends of things changing over time or ordered categories. If there are multiple sets of data, they are used to analyze the interaction and influence of multiple data sets over time or ordered categories. The line's direction indicates positive/negative changes. The slope of the line indicates the degree of change. In this example, we created a basic line chart to show the temperature change of a day.

## Key option

- Declare the `xField` attribute as continuous time intervals or ordered category fields
- Declare the `yField` attribute as numerical fields

## Demo source

```javascript livedemo template=react-vchart
const getData = () =>
  ['2:00', '4:00', '6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map(time => ({
    time,
    value: Math.random() * 10
  }));

const getSpec = () => ({
  type: 'line',
  data: {
    values: getData()
  },
  xField: 'time',
  yField: 'value'
});

const root = document.getElementById(CONTAINER_ID);
const { VChart } = ReactVChart;
const { useState, useRef, useEffect } = React;

const Card = () => {
  const [spec, setSpec] = useState(getSpec());
  const chartRef = useRef(null);
  useEffect(() => {
    window['vchart'] = chartRef;
  }, []);

  const handleSwitchData = () => {
    setSpec(getSpec());
  };

  return (
    <div>
      <VChart ref={chartRef} spec={spec} />
      <button
        style={{ position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, 0)' }}
        onClick={handleSwitchData}
      >
        Switch Data
      </button>
    </div>
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## Related Tutorials

[Line Chart](link)
