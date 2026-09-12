---
title: 17. 如何解决堆叠折线图和双向柱状图组合后，折线图部分分岔的问题？</br>
---
# **问题标题**

如何解决堆叠折线图和双向柱状图组合后，折线图部分分岔的问题？</br>
# **问题描述**

我在使用堆叠折线图和双向柱状图组合后，发现折线图部分分岔了，如下图所示。请问该如何解决？</br>
# **解决方案**

这个问题是因为折线图默认不会按照轴的顺序来给数据排序，会按照数据在数组中的顺序来绘制，这里可以打开sortDataByAxis开关，让数据按照轴的顺序排序，绘制就正常了。</br>


# **代码示例**

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


# **结果展示**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QoU7bR9UjoDQkDxwsp4cioNcnSg.gif' alt='' width='1678' height='1036'>



# **相关文档**

*  相关API：https://www.visactor.io/vchart/option/barChart#sortDataByAxis</br>
*  github：https://github.com/VisActor/VChart</br>

