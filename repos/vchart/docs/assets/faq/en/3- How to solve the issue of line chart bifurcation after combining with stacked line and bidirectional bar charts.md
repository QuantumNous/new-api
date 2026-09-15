---
title: How to solve the problem of the line chart for a stacked line chart and a bidirectional bar chart combination being partially crossed?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---

Title
How to solve the problem of the line chart for a stacked line chart and a bidirectional bar chart combination being partially crossed?</br>


Description
After combining a stacked line chart and a bidirectional bar chart, I found that the line chart is partially forked, as shown in the figure below. How can I solve this problem?</br>


Solution
This problem is caused by the fact that the line chart does not sort the data according to the order of the axis by default, but draws it according to the order of the data in the array. Here, you can turn on the sortDataByAxis switch to sort the data according to the order of the axis, and the drawing will be normal.</br>


Code example</br>
```

const barMockData = [
  { groupName: 'a', name: 'a_修复', type: 'fixedIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'a', name: 'a_新增', type: 'newIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'a', name: 'a_修复', type: 'fixedIssuesObj', time: '2023-09-25', value: 209 },
  { groupName: 'a', name: 'a_新增', type: 'newIssuesObj', time: '2023-09-25', value: 0 },
  { groupName: 'a', name: 'a_修复', type: 'fixedIssuesObj', time: '2023-09-26', value: 104 },
  { groupName: 'a', name: 'a_新增', type: 'newIssuesObj', time: '2023-09-26', value: -3 },
  { groupName: 'a', name: 'a_修复', type: 'fixedIssuesObj', time: '2023-09-27', value: 61 },
  { groupName: 'a', name: 'a_新增', type: 'newIssuesObj', time: '2023-09-27', value: -1 },
  { groupName: 'b', name: 'b_修复', type: 'fixedIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'b', name: 'b_新增', type: 'newIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'b', name: 'b_修复', type: 'fixedIssuesObj', time: '2023-09-25', value: 4 },
  { groupName: 'b', name: 'b_新增', type: 'newIssuesObj', time: '2023-09-25', value: -4 },
  { groupName: 'b', name: 'b_修复', type: 'fixedIssuesObj', time: '2023-09-26', value: 3 },
  { groupName: 'b', name: 'b_新增', type: 'newIssuesObj', time: '2023-09-26', value: -7 },
  { groupName: 'b', name: 'b_修复', type: 'fixedIssuesObj', time: '2023-09-27', value: 4 },
  { groupName: 'b', name: 'b_新增', type: 'newIssuesObj', time: '2023-09-27', value: -8 },
  { groupName: 'c', name: 'c_修复', type: 'fixedIssuesObj', time: '2023-09-24', value: 1 },
  { groupName: 'c', name: 'c_新增', type: 'newIssuesObj', time: '2023-09-24', value: -1 },
  { groupName: 'c', name: 'c_修复', type: 'fixedIssuesObj', time: '2023-09-25', value: 1 },
  { groupName: 'c', name: 'c_新增', type: 'newIssuesObj', time: '2023-09-25', value: -1 },
  { groupName: 'c', name: 'c_修复', type: 'fixedIssuesObj', time: '2023-09-26', value: 1 },
  { groupName: 'c', name: 'c_新增', type: 'newIssuesObj', time: '2023-09-26', value: -1 },
  { groupName: 'c', name: 'c_修复', type: 'fixedIssuesObj', time: '2023-09-27', value: 0 },
  { groupName: 'c', name: 'c_新增', type: 'newIssuesObj', time: '2023-09-27', value: -5 },
  { groupName: 'd', name: 'd_修复', type: 'fixedIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'd', name: 'd_新增', type: 'newIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'd', name: 'd_修复', type: 'fixedIssuesObj', time: '2023-09-25', value: 177 },
  { groupName: 'd', name: 'd_新增', type: 'newIssuesObj', time: '2023-09-25', value: -1 },
  { groupName: 'd', name: 'd_修复', type: 'fixedIssuesObj', time: '2023-09-26', value: 72 },
  { groupName: 'd', name: 'd_新增', type: 'newIssuesObj', time: '2023-09-26', value: -30 },
  { groupName: 'd', name: 'd_修复', type: 'fixedIssuesObj', time: '2023-09-27', value: 127 },
  { groupName: 'd', name: 'd_新增', type: 'newIssuesObj', time: '2023-09-27', value: -9 },
  { groupName: 'e', name: 'e_修复', type: 'fixedIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'e', name: 'e_新增', type: 'newIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'e', name: 'e_修复', type: 'fixedIssuesObj', time: '2023-09-25', value: 48 },
  { groupName: 'e', name: 'e_新增', type: 'newIssuesObj', time: '2023-09-25', value: -4 },
  { groupName: 'e', name: 'e_修复', type: 'fixedIssuesObj', time: '2023-09-26', value: 333 },
  { groupName: 'e', name: 'e_新增', type: 'newIssuesObj', time: '2023-09-26', value: -1 },
  { groupName: 'e', name: 'e_修复', type: 'fixedIssuesObj', time: '2023-09-27', value: 26 },
  { groupName: 'e', name: 'e_新增', type: 'newIssuesObj', time: '2023-09-27', value: -3 },
  { groupName: 'f', name: 'f_修复', type: 'fixedIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'f', name: 'f_新增', type: 'newIssuesObj', time: '2023-09-24', value: 0 },
  { groupName: 'f', name: 'f_修复', type: 'fixedIssuesObj', time: '2023-09-25', value: 57 },
  { groupName: 'f', name: 'f_新增', type: 'newIssuesObj', time: '2023-09-25', value: -3 },
  { groupName: 'f', name: 'f_修复', type: 'fixedIssuesObj', time: '2023-09-26', value: 1 },
  { groupName: 'f', name: 'f_新增', type: 'newIssuesObj', time: '2023-09-26', value: -11 },
  { groupName: 'f', name: 'f_修复', type: 'fixedIssuesObj', time: '2023-09-27', value: 43 },
  { groupName: 'f', name: 'f_新增', type: 'newIssuesObj', time: '2023-09-27', value: 0 }
];
const mockData = [
  { value: 2360, name: 'a', date: '2023-09-23' },
  { value: 3829, name: 'b', date: '2023-09-23' },
  { value: 1102, name: 'c', date: '2023-09-23' },
  { value: 4856, name: 'd', date: '2023-09-23' },
  { value: 5039, name: 'e', date: '2023-09-23' },
  { value: 2180, name: 'f', date: '2023-09-23' },
  { value: 2360, name: 'a', date: '2023-09-24' },
  { value: 3829, name: 'b', date: '2023-09-24' },
  { value: 1102, name: 'c', date: '2023-09-24' },
  { value: 4856, name: 'd', date: '2023-09-24' },
  { value: 5039, name: 'e', date: '2023-09-24' },
  { value: 2180, name: 'f', date: '2023-09-24' },
  { value: 2140, name: 'a', date: '2023-09-25' },
  { value: 3829, name: 'b', date: '2023-09-25' },
  { value: 1102, name: 'c', date: '2023-09-25' },
  { value: 4670, name: 'd', date: '2023-09-25' },
  { value: 4990, name: 'e', date: '2023-09-25' },
  { value: 2123, name: 'f', date: '2023-09-25' },
  { value: 2028, name: 'a', date: '2023-09-26' },
  { value: 3833, name: 'b', date: '2023-09-26' },
  { value: 1102, name: 'c', date: '2023-09-26' },
  { value: 4621, name: 'd', date: '2023-09-26' },
  { value: 4644, name: 'e', date: '2023-09-26' },
  { value: 2133, name: 'f', date: '2023-09-26' },
  { value: 1967, name: 'a', date: '2023-09-27' },
  { value: 3837, name: 'b', date: '2023-09-27' },
  { value: 1107, name: 'c', date: '2023-09-27' },
  { value: 4498, name: 'd', date: '2023-09-27' },
  { value: 4622, name: 'e', date: '2023-09-27' },
  { value: 2087, name: 'f', date: '2023-09-27' },
  { value: 1911, name: 'a', date: '2023-09-28' },
  { value: 3838, name: 'b', date: '2023-09-28' },
  { value: 1106, name: 'c', date: '2023-09-28' },
  { value: 4042, name: 'd', date: '2023-09-28' },
  { value: 4617, name: 'e', date: '2023-09-28' },
  { value: 2087, name: 'f', date: '2023-09-28' }
];
const spec = {
  type: 'common',
  bar: { state: { hover: { style: { fillOpacity: 0.5 } } }, style: { cursor: 'pointer' } },
  title: {
    visible: true,
    align: 'left',
    verticalAlign: 'top',
    orient: 'top',
    innerPadding: { bottom: 10 },
    text: '每日问题详情',
    subtext: '左Y轴正数为修复数，负数为新增数（可点击柱体查看详情）。右轴为每日总问题数'
  },
  data: [
    { id: 'barData', values: barMockData },
    { id: 'id1', values: mockData }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      seriesField: 'name',
      xField: ['time', 'groupName'],
      yField: 'value'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      xField: 'date',
      yField: 'value',
      seriesField: 'name',
      stack: true,
      sortDataByAxis: true
    }
  ],
  axes: [
    { orient: 'left', id: 'bar', seriesId: ['bar'], tick: { tickCount: 6 }, nice: true },
    {
      orient: 'right',
      seriesId: ['line'],
      sync: { axisId: 'bar', tickAlign: true },
      gird: { visible: false },
      nice: true
    },
    { orient: 'bottom', domainLine: { onZero: true } }
  ],
  legends: { visible: true, padding: { top: '2%', right: '10%' } },
  tooltip: {
    mark: {
      content: [
        {
          key: (datum) => datum?.name,
          value: (datum) => (datum?.value < 0 ? 0 - datum?.value : datum?.value)
        }
      ]
    },
    dimension: {
      content: [
        {
          key: (datum) => datum?.name,
          value: (datum) => (datum?.value < 0 ? 0 - datum?.value : datum?.value)
        }
      ]
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderAsync();
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
</br>
```


Result</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/M3nGb1UUGoyk1oxHK3icGc34nHf.gif' alt='' width='1678' height='1036'>



Related documentation</br>
*  Related API: [https://www.visactor.io/vchart/option/barChart#sortDataByAxis](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Foption%2FbarChart%23sortDataByAxis)</br>
*  Github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>



