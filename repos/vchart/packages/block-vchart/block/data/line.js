export default {
  type: 'line',
  data: {
    values: [
      {date: '2023-01-01',type: '产品 A',value: 99.9},
      {date: '2023-01-01',type: '产品 B',value: 96.6},
      {date: '2023-01-01',type: '产品 C',value: 96.2},
      {date: '2023-01-02',type: '产品 A',value: 96.7},
      {date: '2023-01-02',type: '产品 B',value: 91.1},
      {date: '2023-01-02',type: '产品 C',value: 93.4},
      {date: '2023-01-03',type: '产品 A',value: 100.2},
      {date: '2023-01-03',type: '产品 B',value: 99.4},
      {date: '2023-01-03',type: '产品 C',value: 91.7},
      {date: '2023-01-04',type: '产品 A',value: 104.7},
      {date: '2023-01-04',type: '产品 B',value: 108.1},
      {date: '2023-01-04',type: '产品 C',value: 93.1},
      {date: '2023-01-05',type: '产品 A',value: 95.6},
      {date: '2023-01-05',type: '产品 B',value: 96},
      {date: '2023-01-05',type: '产品 C',value: 92.3},
      {date: '2023-01-06',type: '产品 A',value: 95.6},
      {date: '2023-01-06',type: '产品 B',value: 89.1},
      {date: '2023-01-06',type: '产品 C',value: 92.5},
      {date: '2023-01-07',type: '产品 A',value: 95.3},
      {date: '2023-01-07',type: '产品 B',value: 89.2},
      {date: '2023-01-07',type: '产品 C',value: 95.7},
      {date: '2023-01-08',type: '产品 A',value: 96.1},
      {date: '2023-01-08',type: '产品 B',value: 97.6},
      {date: '2023-01-08',type: '产品 C',value: 99.9},
      {date: '2023-01-09',type: '产品 A',value: 96.1},
      {date: '2023-01-09',type: '产品 B',value: 100.6},
      {date: '2023-01-09',type: '产品 C',value: 103.8},
      {date: '2023-01-10',type: '产品 A',value: 101.6},
      {date: '2023-01-10',type: '产品 B',value: 108.3},
      {date: '2023-01-10',type: '产品 C',value: 108.9},
    ]
  },
  xField: 'date',
  yField: 'value',
  seriesField: 'type',
  point: {
    visible: false
  },
  legends: {
    visible: true,
    orient: 'bottom'
  },
  label: {
    visible: true,
    position: 'top',
    formatMethod: 'labelFormat',
  },
}
