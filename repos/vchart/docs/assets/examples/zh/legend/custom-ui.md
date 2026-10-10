---
category: demo
group: legend
title: 自定义图例 UI
keywords: barChart,comparison,rectangle,legend,distribution,rank,composition
order: 27-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/custom-ui.png
option: barChart#legends
---

# 自定义图例 UI

当图例整体的展示样式不满足需求时，可以通过 `visible` 属性关闭图例的展示，然后通过提供的相关图例的 api 实现自定义图例的展示及交互。

## 关键配置

- `legends.visible` 配置为 false，关闭图例的展示
- `vchart.getLegendSelectedDataByIndex()` 接口获取图例项数据
- `vchart.setLegendSelectedDataByIndex()` 接口设置图例项的选中数据

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar',
      values: [
        { x: 'Round 1', y: 21, c: 'Role A' },
        { x: 'Round 1', y: 38, c: 'Role B' },
        { x: 'Round 2', y: 28, c: 'Role A' },
        { x: 'Round 2', y: 45, c: 'Role B' },
        { x: 'Round 3', y: 22, c: 'Role A' },
        { x: 'Round 3', y: 56, c: 'Role B' },
        { x: 'Round 4', y: 34, c: 'Role A' },
        { x: 'Round 4', y: 48, c: 'Role B' },
        { x: 'Round 5', y: 34, c: 'Role A' },
        { x: 'Round 5', y: 64, c: 'Role B' },
        { x: 'Round 6', y: 44, c: 'Role A', latest: true },
        { x: 'Round 6', y: 72, c: 'Role B', latest: true },
        { x: 'Round 7', y: 38, c: 'Role A', latest: true },
        { x: 'Round 7', y: 65, c: 'Role B', latest: true },
        { x: 'Round 8', y: 24, c: 'Role A', latest: true },
        { x: 'Round 8', y: 70, c: 'Role B', latest: true },
        { x: 'Round 9', y: 28, c: 'Role A', latest: true },
        { x: 'Round 9', y: 62, c: 'Role B', latest: true }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  axes: [{ orient: 'left' }, { orient: 'bottom' }],
  legends: {
    visible: false
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
const legendSelected = vchart.getLegendSelectedDataByIndex();
const chartDiv = document.getElementById(CONTAINER_ID);
const checkboxContainer = document.createElement('div');
checkboxContainer.style.textAlign = 'center';
const checkbox = document.createElement('input');
const checkboxLabel = document.createElement('label');

checkboxContainer.setAttribute('id', 'checkboxContainer');

checkbox.setAttribute('type', 'checkbox');
checkbox.setAttribute('id', 'checkbox');
checkbox.style.verticalAlign = 'middle';

checkbox.checked = false;

checkboxLabel.innerText = ' Hide Role A';
checkboxLabel.style.verticalAlign = 'middle';

checkboxContainer.appendChild(checkbox);
checkboxContainer.appendChild(checkboxLabel);
chartDiv?.prepend(checkboxContainer);

checkbox.addEventListener('change', event => {
  if (event.currentTarget.checked) {
    vchart.setLegendSelectedDataByIndex(
      0,
      legendSelected.filter(val => val !== 'Role A')
    );
  } else {
    vchart.setLegendSelectedDataByIndex(0, legendSelected);
  }
});

window.customRelease = () => {
  const checkboxDom = document.getElementById('checkboxContainer');
  checkboxDom && checkboxDom.remove();
};

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
