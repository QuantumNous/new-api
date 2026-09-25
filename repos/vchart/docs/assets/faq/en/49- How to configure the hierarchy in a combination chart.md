---
title: 43. How to configure the common chart zIndex?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to configure the combination chart hierarchy?</br>


# Description


How to configure the combination chart hierarchy? When combining line and area series, the point primitive of line is obscured by the area primitive</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DCzwbYHfPoTpk6xeJTUcQVOunMg.gif' alt='' width='817' height='530'>

## Solution

For the cascading style of series in the combination diagram, it can be controlled by the declaration order of series. For example, if the line series needs to be above the area series, then the area series needs to be declared first, and then the line series needs to be declared.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C4kIbBSHYoDQq2xXQcUc7jfwn0g.gif' alt='' width='3268' height='1060'>





## Code Example

```
  const data = [
    { date: "2023-12-01", value: "1776", series: "demand" },
    { date: "2023-12-01", value: 1546, series: "left" },
    { date: "2023-12-01", value: "3322", series: "total" },
    { date: "2023-12-02", value: "3555", series: "demand" },
    { date: "2023-12-02", value: 43638, series: "left" },
    { date: "2023-12-02", value: "47193", series: "total" },
    { date: "2023-12-03", value: "52840", series: "demand" },
    { date: "2023-12-03", value: 6864, series: "left" },
    { date: "2023-12-03", value: "59704", series: "total" },
    { date: "2023-12-04", value: "48566", series: "demand" },
    { date: "2023-12-04", value: 41413, series: "left" },
    { date: "2023-12-04", value: "89979", series: "total" },
    { date: "2023-12-05", value: "17711", series: "demand" },
    { date: "2023-12-05", value: 26783, series: "left" },
    { date: "2023-12-05", value: "44494", series: "total" },
    { date: "2023-12-06", value: "4295", series: "demand" },
    { date: "2023-12-06", value: 363, series: "left" },
    { date: "2023-12-06", value: "4658", series: "total" },
    { date: "2023-12-07", value: "16", series: "demand" },
    { date: "2023-12-07", value: 8757, series: "left" },
    { date: "2023-12-07", value: "8773", series: "total" },
    { date: "2023-12-08", value: "29228", series: "demand" },
    { date: "2023-12-08", value: 29999, series: "left" },
    { date: "2023-12-08", value: "59227", series: "total" },
    { date: "2023-12-09", value: "29092", series: "demand" },
    { date: "2023-12-09", value: 15516, series: "left" },
    { date: "2023-12-09", value: "44608", series: "total" },
    { date: "2023-12-010", value: "4098", series: "demand" },
    { date: "2023-12-010", value: 4946, series: "left" },
    { date: "2023-12-010", value: "9044", series: "total" },
    { date: "2023-12-011", value: "11611", series: "demand" },
    { date: "2023-12-011", value: 64795, series: "left" },
    { date: "2023-12-011", value: "76406", series: "total" },
    { date: "2023-12-012", value: "72517", series: "demand" },
    { date: "2023-12-012", value: 11808, series: "left" },
    { date: "2023-12-012", value: "84325", series: "total" },
    { date: "2023-12-013", value: "15421", series: "demand" },
    { date: "2023-12-013", value: 16839, series: "left" },
    { date: "2023-12-013", value: "32260", series: "total" },
    { date: "2023-12-014", value: "5185", series: "demand" },
    { date: "2023-12-014", value: 18225, series: "left" },
    { date: "2023-12-014", value: "23410", series: "total" },
    { date: "2023-12-015", value: "9034", series: "demand" },
    { date: "2023-12-015", value: 35726, series: "left" },
    { date: "2023-12-015", value: "44760", series: "total" },
    { date: "2023-12-016", value: "20138", series: "demand" },
    { date: "2023-12-016", value: 42747, series: "left" },
    { date: "2023-12-016", value: "62885", series: "total" },
    { date: "2023-12-017", value: "1649", series: "demand" },
    { date: "2023-12-017", value: 6281, series: "left" },
    { date: "2023-12-017", value: "7930", series: "total" },
    { date: "2023-12-018", value: "3687", series: "demand" },
    { date: "2023-12-018", value: 5087, series: "left" },
    { date: "2023-12-018", value: "8774", series: "total" },
    { date: "2023-12-019", value: "49861", series: "demand" },
    { date: "2023-12-019", value: 14074, series: "left" },
    { date: "2023-12-019", value: "63935", series: "total" },
    { date: "2023-12-020", value: "4386", series: "demand" },
    { date: "2023-12-020", value: 33871, series: "left" },
    { date: "2023-12-020", value: "38257", series: "total" },
    { date: "2023-12-021", value: "5066", series: "demand" },
    { date: "2023-12-021", value: 34438, series: "left" },
    { date: "2023-12-021", value: "39504", series: "total" },
    { date: "2023-12-022", value: "3070", series: "demand" },
    { date: "2023-12-022", value: 47549, series: "left" },
    { date: "2023-12-022", value: "50619", series: "total" },
    { date: "2023-12-023", value: "7493", series: "demand" },
    { date: "2023-12-023", value: 83660, series: "left" },
    { date: "2023-12-023", value: "91153", series: "total" },
    { date: "2023-12-024", value: "40735", series: "demand" },
    { date: "2023-12-024", value: 8841, series: "left" },
    { date: "2023-12-024", value: "49576", series: "total" },
    { date: "2023-12-025", value: "15730", series: "demand" },
    { date: "2023-12-025", value: 8965, series: "left" },
    { date: "2023-12-025", value: "24695", series: "total" },
    { date: "2023-12-026", value: "64354", series: "demand" },
    { date: "2023-12-026", value: 31912, series: "left" },
    { date: "2023-12-026", value: "96266", series: "total" },
    { date: "2023-12-027", value: "15469", series: "demand" },
    { date: "2023-12-027", value: 28519, series: "left" },
    { date: "2023-12-027", value: "43988", series: "total" },
    { date: "2023-12-028", value: "249", series: "demand" },
    { date: "2023-12-028", value: 7200, series: "left" },
    { date: "2023-12-028", value: "7449", series: "total" },
    { date: "2023-12-029", value: "9296", series: "demand" },
    { date: "2023-12-029", value: 26689, series: "left" },
    { date: "2023-12-029", value: "35985", series: "total" },
    { date: "2023-12-030", value: "4776", series: "demand" },
    { date: "2023-12-030", value: 368, series: "left" },
    { date: "2023-12-030", value: "5144", series: "total" },
    { date: "2023-12-031", value: "50932", series: "demand" },
    { date: "2023-12-031", value: 2237, series: "left" },
    { date: "2023-12-031", value: "53169", series: "total" },
    { date: "2023-12-032", value: "12191", series: "demand" },
    { date: "2023-12-032", value: 45954, series: "left" },
    { date: "2023-12-032", value: "58145", series: "total" },
    { date: "2023-12-033", value: "1615", series: "demand" },
    { date: "2023-12-033", value: 57757, series: "left" },
    { date: "2023-12-033", value: "59372", series: "total" },
    { date: "2023-12-034", value: "16892", series: "demand" },
    { date: "2023-12-034", value: 23399, series: "left" },
    { date: "2023-12-034", value: "40291", series: "total" },
    { date: "2023-12-035", value: "12452", series: "demand" },
    { date: "2023-12-035", value: 2427, series: "left" },
    { date: "2023-12-035", value: "14879", series: "total" },
    { date: "2023-12-036", value: "86059", series: "demand" },
    { date: "2023-12-036", value: 8673, series: "left" },
    { date: "2023-12-036", value: "94732", series: "total" },
    { date: "2023-12-037", value: "1355", series: "demand" },
    { date: "2023-12-037", value: 23182, series: "left" },
    { date: "2023-12-037", value: "24537", series: "total" },
    { date: "2023-12-038", value: "6865", series: "demand" },
    { date: "2023-12-038", value: 26607, series: "left" },
    { date: "2023-12-038", value: "33472", series: "total" },
    { date: "2023-12-039", value: "63665", series: "demand" },
    { date: "2023-12-039", value: 11211, series: "left" },
    { date: "2023-12-039", value: "74876", series: "total" },
    { date: "2023-12-040", value: "14291", series: "demand" },
    { date: "2023-12-040", value: 62592, series: "left" },
    { date: "2023-12-040", value: "76883", series: "total" },
    { date: "2023-12-041", value: "13291", series: "demand" },
    { date: "2023-12-041", value: 27065, series: "left" },
    { date: "2023-12-041", value: "40356", series: "total" },
    { date: "2023-12-042", value: "33858", series: "demand" },
    { date: "2023-12-042", value: 11867, series: "left" },
    { date: "2023-12-042", value: "45725", series: "total" },
  ];

  const spec = {
    type: "common",
    seriesField: "color",
    data: [
      { id: "id0", values: data.filter((o) => o.series !== "total") },
      { id: "id1", values: data.filter((o) => o.series === "total") },
    ],
    series: [
      {
        type: "area",
        id: "bar",
        dataIndex: 0,
        label: { visible: true },
        dataIndex: 0,
        xField: "date",
        yField: "value",
        seriesField: "series",
        area: { zIndex: -1 },
        line: {
          style: {
            lineDash: [2, 2],
            lineWidth: (data) => (data.series === "left" ? 0 : 1),
          },
        },

        dataZoom: { zIndex: 500 },
        point: {
          style: { size: 0 },
          state: {
            dimension_hover: {
              size: (data) => (data.series === "left" ? 0 : 8),
            },
          },
        },
        label: { visible: false },
        area: {
          style: {
            fillOpacity: (data) => (data.series === "left" ? 0.7 : 0.3),
            textureColor: "#fff",
            fill: (data) => (data.series === "left" ? "#bcc0cd" : "#1AC6FF"),
            textureSize: 4,
            texture: (data) => {
              if (data.series === "left") {
                return "bias-rl";
              }
              return null;
            },
          },
        },
      },
      {
        type: "line",
        id: "line",
        dataIndex: 1,
        label: { visible: true },
        seriesField: "series",
        xField: "date",
        yField: "value",
        stack: false,
        label: { visible: false },
        dataZoom: { zIndex: 1000 },
        line: {
          style: {
            lineDash: [2, 2],
            lineWidth: 1,
          },
        },
        point: {
          style: { size: 0 },
          state: {
            dimension_hover: { size: 8 },
          },
        },
      },
    ],
    axes: [
      { orient: "left", visible: false },
      { orient: "right", visible: false },
      { orient: "bottom", label: { visible: true }, type: "band" },
    ],
    legends: { visible: true, orient: "bottom" },
  };
const vchart = new VChart(spec, { dom: CONTAINER_ID }); vchart.renderAsync(); 
window['vchart'] = vchart;
</br>
```
## Results

Online demo：hhttps://codesandbox.io/p/sandbox/zindex-4dtk4g?file=%2Fsrc%2Findex.ts%3A4%2C1-217%2C5</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/YBTIbWfgmoh7kaxJCUZcKeZcnVh.gif' alt='' width='1436' height='956'>



## Related Documentation

Common Chart Demo：https://www.visactor.io/vchart/demo/combination/single-region</br>
Common Chart Tutorial：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination</br>
github：https://github.com/VisActor/VChart</br>



