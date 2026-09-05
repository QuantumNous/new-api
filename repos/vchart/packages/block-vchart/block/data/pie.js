export default {
  type: 'pie',
  data: {
    values: [
      {
        value: 159,
        type: 'Tradition Industries'
      },
      {
        value: 50,
        type: 'Business Companies'
      },
      {
        value: 13,
        type: 'Customer-facing Companies'
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'bottom'
  },
  radius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  label: {
    visible: true,
    formatMethod: (text, datum) => {
      return [text, datum.value]
    }
  },
}
