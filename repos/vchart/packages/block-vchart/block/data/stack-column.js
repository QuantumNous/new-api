export default {
  type: 'bar',
  data: {
    values: [
      {
        time: '2:00',
        value: 8,
        type: '某音'
      },
      {
        time: '4:00',
        value: 9,
        type: '某音'
      },
      {
        time: '6:00',
        value: 11,
        type: '某音'
      },
      {
        time: '8:00',
        value: 14,
        type: '某音'
      },
      {
        time: '10:00',
        value: 16,
        type: '某音'
      },
      {
        time: '12:00',
        value: 17,
        type: '某音'
      },
      {
        time: '14:00',
        value: 17,
        type: '某音'
      },
      {
        time: '16:00',
        value: 16,
        type: '某音'
      },
      {
        time: '18:00',
        value: 15,
        type: '某音'
      },

      {
        time: '2:00',
        value: 7,
        type: 'B站'
      },
      {
        time: '4:00',
        value: 8,
        type: 'B站'
      },
      {
        time: '6:00',
        value: 9,
        type: 'B站'
      },
      {
        time: '8:00',
        value: 10,
        type: 'B站'
      },
      {
        time: '10:00',
        value: 9,
        type: 'B站'
      },
      {
        time: '12:00',
        value: 12,
        type: 'B站'
      },
      {
        time: '14:00',
        value: 14,
        type: 'B站'
      },
      {
        time: '16:00',
        value: 12,
        type: 'B站'
      },
      {
        time: '18:00',
        value: 14,
        type: 'B站'
      }
    ]
  },
  color: ['#6690F2', '#70D6A3'],
  xField: 'time',
  yField: 'value',
  stack: true,
  seriesField: 'type',
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'right'
  },
  crosshair: {
    xField: {
      visible: true
    }
  }
}
