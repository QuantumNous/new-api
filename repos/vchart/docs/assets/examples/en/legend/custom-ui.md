---
category: demo
group: legend
title: Custom Legend UI
keywords: barChart, comparison, rectangle, legend, distribution, rank, composition
order: 27-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/custom-ui.png
option: barChart#legends
---

# Custom Legend UI

When the overall presentation style of the legend does not meet the requirements, you can turn off the presentation of the legend through the `visible` attribute, and then display and interact with the custom legend through the provided related legend APIs.

## Key option

- Set `legends.visible` to false, to turn off the presentation of the legend.
- Use the `vchart.getLegendSelectedDataByIndex()` interface to obtain legend item data.
- Use the `vchart.setLegendSelectedDataByIndex()` interface to set the selected data of legend items.

## Demo source

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

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
