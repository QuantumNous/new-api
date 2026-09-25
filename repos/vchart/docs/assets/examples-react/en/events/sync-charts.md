---
category: examples
group: events
title: 图表联动
keywords: lineChart,comparison,trend,line
order: 0-0
cover: /vchart/preview/events-sync-charts_1.11.0.png
option: lineChart
---

# 图表联动

当两个图表具有相同的维度信息时，可以通过`hover`、`click`交互实现图表的联动效果；这里展示了 hover 触发的两个图表联动效果

## 关键配置

- `onDimensionHover` `react-vchart`图表组件通过该属性，绑定`dimensionHover`事件
- `ref` 获取`vchart`实例
- `setDimensionIndex` `vchart`实例提供的 api，设置高亮的维度

## 代码演示

```javascript livedemo template=react-vchart
const getData = () =>
  ['2:00', '4:00', '6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map(time => ({
    time,
    value: Math.random() * 10
  }));

const getLineSpec = () => ({
  type: 'line',
  data: {
    values: getData()
  },
  xField: 'time',
  yField: 'value',
  crosshair: {
    xField: {
      label: {
        visible: true
      }
    }
  }
});

const getBarSpec = () => ({
  type: 'bar',
  data: {
    values: getData()
  },
  xField: 'time',
  yField: 'value',
  crosshair: {
    xField: {
      label: {
        visible: true
      }
    }
  }
});

const root = document.getElementById(CONTAINER_ID);
const { VChart } = ReactVChart;
const { useState, useRef, useEffect, useCallback } = React;

const Card = () => {
  const [lineSpec, setLineSpec] = useState(getLineSpec());
  const [barSpec, setBarSpec] = useState(getBarSpec());
  const lineChartRef = useRef(null);
  const barChartRef = useRef(null);

  useEffect(() => {
    window['vchart'] = lineChartRef.current;
  }, []);

  const handleSwitchData = () => {
    setLineSpec(getLineSpec());
    setBarSpec(getBarSpec());
  };

  const handleLineChartDimensionHover = useCallback(params => {
    if (!barChartRef.current) {
      return;
    }

    const dimensionValue = params.dimensionInfo && params.dimensionInfo[0] && params.dimensionInfo[0].value;

    if (dimensionValue != null) {
      barChartRef.current.setDimensionIndex(dimensionValue, { tooltip: false });
    } else {
      barChartRef.current.setDimensionIndex(null, { tooltip: false });
    }
  }, []);
  const handleBarChartDimensionHover = useCallback(params => {
    if (!lineChartRef.current) {
      return;
    }
    const dimensionValue = params.dimensionInfo && params.dimensionInfo[0] && params.dimensionInfo[0].value;

    if (dimensionValue != null) {
      lineChartRef.current.setDimensionIndex(dimensionValue, { tooltip: false });
    } else {
      lineChartRef.current.setDimensionIndex(null, { tooltip: false });
    }
  }, []);

  return (
    <div className="chart-containers">
      <div className="inner-container" style={{ display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <VChart ref={lineChartRef} spec={lineSpec} onDimensionHover={handleLineChartDimensionHover} />
        </div>
        <div style={{ flex: 1 }}>
          <VChart ref={barChartRef} spec={barSpec} onDimensionHover={handleBarChartDimensionHover} />
        </div>
      </div>
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

## 相关教程

[折线图](link)
