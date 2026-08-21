export default {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  tooltip: {
    style: {
      panel: {
        shadow: {
          blur: 20,
          offsetX: 4,
          color: '#ff9b9b9b'
        }
      }
    },
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  },
  outerRadius: 0.6,
  valueField: 'value',
  categoryField: 'type',
  legends: {
    visible: true,
    orient: 'bottom',
    maxRow: 1
  },
  label: {
    visible: true
  },
  pie: {
    state: {
      hover: {
        radiusOffset: 10
      }
    }
  }
}
