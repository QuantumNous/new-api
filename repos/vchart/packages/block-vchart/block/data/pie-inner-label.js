export default {
  type: 'pie',
  data: [
    {
      name: 'data1',
      values: [
        {
          value: 335,
          name: '类别1'
        },
        {
          value: 310,
          name: '类别2'
        },
        {
          value: 274,
          name: '类别3'
        },
        {
          value: 189,
          name: '类别4'
        },
        {
          value: 312,
          name: '类别5'
        },
        {
          value: 235,
          name: '类别6'
        },
        {
          value: 189,
          name: '类别7'
        },
        {
          value: 312,
          name: '类别8'
        },
        {
          value: 235,
          name: '类别9'
        },
        {
          value: 235,
          name: '类别10'
        },
      ]
    }
  ],
  radius: 1,
  valueField: 'value',
  categoryField: 'name',
  label: {
    visible: true,
    position: 'inside',
    showRule: 'all',

      style: {
        fill: '#fff',
        align: 'right',
        text: datum => datum.type
      }
  },
  pie: {
    state: {
      hover: {
        outerRadius: 1.05
      }
    }
  },
  legends: {
    visible: true,
    orient: 'right',
  },
};
