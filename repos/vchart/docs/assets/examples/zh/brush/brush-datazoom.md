---
category: demo
group: brush
title: 框选控制缩放
keywords: scatterChart,brush
order: 32-3
cover: /vchart/preview/brush-datazoom_1.10.0.gif
option: scatterChart#brush
---

# 框选控制缩放

通过绑定dataZoom可以实现框选控制画布缩放的效果。

## 关键配置

- `zoomAfterBrush` 属性声明为刷取后是否更新axis/dataZoom范围。


## 代码演示

```javascript livedemo
// step1: get data
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/scatter-data-population.json');
const scatterData = await response.json();

// step2: util of log scale for scatter size mapping
function logScale(value, domain, range) {
  const logDomain = domain.map(x => (x !== 0 ? Math.log10(x) : 0));
  const logRange = range.map(x => Math.log10(x));

  const t = (Math.log10(value) - logDomain[0]) / (logDomain[1] - logDomain[0]);
  const newValue = (logRange[1] - logRange[0]) * t + logRange[0];

  return Math.pow(10, newValue);
}

// step3: compute data range for custom domain
const minRange = Math.min(...scatterData.map(d => d.LifeExpectancy)) - 10
const maxRange = Math.max(...scatterData.map(d => d.LifeExpectancy)) + 10

// step4: init some variable
const xDataZoomInitState = { start: 0, end: 1 };
const yDataZoomInitState = { start: 0, end: 1 };
// for go back last state
const history = [
  {
    id: Math.random(),
    record: [
      {
        start: xDataZoomInitState.start,
        end: xDataZoomInitState.end
      },
      {
        start: yDataZoomInitState.start,
        end: yDataZoomInitState.end
      }
    ]
  }
]

// step5: decalre spec & render chart, you can focus on brush and dataZoom spec
const spec = {
  type: 'scatter',
  data: {
    values: scatterData
  },
  xField: 'GDP',
  yField: 'LifeExpectancy',
  seriesField: 'continent',
  sizeField: 'Population',
  size: d => logScale(d.Population, [0, Math.max(...scatterData.map(d => d.Population))], [1, 40]),
  legends: [
    {
      visible: true,
      orient: 'bottom',
      position: 'middle'
    }
  ],
  axes: [
    {
      type: 'linear',
      orient: 'left',
      id: 'yAxis', // for dataZoom related axis
      // for align range with dataZoom
      max: maxRange, 
      min: minRange,
      zero: false,
      nice: false
    },
    {
      type: 'linear',
      orient: 'bottom',
      // for align range with dataZoom
      zero: false,
      nice: false,
      max: 50000,
      min: 0
    }
  ],
  dataZoom: [
    {
      filterMode: 'axis',
      orient: 'bottom',
      customDomain: [0, 50000]
    },
    {
      filterMode: 'axis',
      orient: 'right',
      axisId: 'yAxis',
      customDomain: [minRange, maxRange]
    }
  ],
  brush: {
    visible: true,
    brushType: 'rect',
    inBrush: {
      colorAlpha: 1
    },
    outOfBrush: {
      colorAlpha: 0.2
    },
    // 开启后默认关联所有axis/dataZoom
    zoomAfterBrush: true
  },
  tooltip: {
    dimension: {
      visible: true
    },
    mark: {
      title: true,
      content: [
        {
          key: d => d.name,
          value: d => d.y
        }
      ]
    }
  },
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;


// step6: add listener for brushEnd and record state
vchart.on('brushEnd', args => {
  history.push({
    id: Math.random(),
    record: args.value.zoomRecord
  })
})

// step7: go back last state by button
const button = document.createElement('button');
button.text = 'back';
button.onclick = () => {
  history.pop()
  const xDataZoom = history[history.length - 1].record[1];
  const yDataZoom = history[history.length - 1].record[0];
  const newSpec = {
    ...spec,
    dataZoom: [
      {
        ...spec.dataZoom[0],
        start: xDataZoom.start,
        end: xDataZoom.end
      },
      {
        ...spec.dataZoom[1],
        start: yDataZoom.start,
        end: yDataZoom.end
      },
    ]
  }
  

  vchart.updateSpec(newSpec);
}
document.getElementById(CONTAINER_ID)?.appendChild(button);


```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
