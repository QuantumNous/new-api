export default {
  type: 'sankey',
  data: [
    {
      values: [
          {
            nodes: [
              { nodeName: 'Country A' },
              { nodeName: 'Country B' },
              { nodeName: 'Country C' },
              { nodeName: 'Country D' },
              { nodeName: 'Country E' },
              { nodeName: 'Country F' },
              { nodeName: 'Country G' },
              { nodeName: 'Country H' },
              { nodeName: 'Country I' },
              { nodeName: 'Country J' },
              { nodeName: 'Country K' },
              { nodeName: 'Country L' },
              { nodeName: 'Country M' },
              { nodeName: 'Country N' },
              { nodeName: 'Country O' },
              { nodeName: 'Country P' }
            ],
            links: [
              { source: 0, target: 1, value: 5 },
              { source: 0, target: 2, value: 1 },
              { source: 0, target: 3, value: 1 },
              { source: 0, target: 4, value: 1 },
              { source: 5, target: 1, value: 1 },
              { source: 5, target: 2, value: 5 },
              { source: 5, target: 4, value: 1 },
              { source: 6, target: 1, value: 1 },
              { source: 6, target: 2, value: 1 },
              { source: 6, target: 3, value: 5 },
              { source: 6, target: 4, value: 1 },
              { source: 7, target: 1, value: 1 },
              { source: 7, target: 2, value: 1 },
              { source: 7, target: 3, value: 1 },
              { source: 7, target: 4, value: 5 },
              { source: 1, target: 8, value: 2 },
              { source: 1, target: 9, value: 1 },
              { source: 1, target: 10, value: 1 },
              { source: 1, target: 11, value: 3 },
              { source: 2, target: 8, value: 1 },
              { source: 2, target: 9, value: 3 },
              { source: 2, target: 12, value: 3 },
              { source: 2, target: 10, value: 3 },
              { source: 2, target: 11, value: 1 },
              { source: 3, target: 9, value: 1 },
              { source: 3, target: 10, value: 3 },
              { source: 3, target: 11, value: 1 },
              { source: 4, target: 8, value: 1 },
              { source: 4, target: 9, value: 1 },
              { source: 4, target: 10, value: 2 },
              { source: 4, target: 11, value: 7 },
              { source: 11, target: 13, value: 5 },
              { source: 11, target: 14, value: 1 },
              { source: 11, target: 15, value: 3 },
              { source: 8, target: 13, value: 5 },
              { source: 8, target: 14, value: 1 },
              { source: 8, target: 15, value: 3 },
              { source: 9, target: 13, value: 5 },
              { source: 9, target: 14, value: 1 },
              { source: 9, target: 15, value: 3 },
              { source: 12, target: 13, value: 5 },
              { source: 12, target: 14, value: 1 },
              { source: 12, target: 15, value: 3 },
              { source: 10, target: 13, value: 5 },
              { source: 10, target: 14, value: 1 },
              { source: 10, target: 15, value: 3 }
            ]
          }
      ]
    }
  ],
  categoryField: 'nodeName',
  valueField: 'value',
  sourceField: 'source',
  targetField: 'target',

  nodeAlign: 'justify',
  nodeGap: 8,
  nodeWidth: 10,
  minNodeHeight: 4,

  tooltip: {
    style: {
      panel: {
        shadow: {
          blur: 20,
          offsetX: 4,
          color: '#ff9b9b9b'
        }
      }
    }
  },

  title: {
    text: 'How energy is converted or transmitted before being consumed or lost',
    subtext: 'Data: Department of Energy & Climate Change via Tom Counsell',
    subtextStyle: {
      fontSize: 12
    },
    padding: {
      bottom: 12
    }
  },

  label: {
    visible: true,
    style: {
      fontSize: 10
    }
  },

  node: {
    state: {
      hover: {
        stroke: '#333333'
      },
      selected: {
        fill: '#dddddd',
        stroke: '#333333',
        strokeWidth: 1,
        brighter: 1,
        fillOpacity: 1
      }
    }
  },

  link: {
    state: {
      hover: {
        fillOpacity: 1
      },
      selected: {
        fill: '#dddddd',
        stroke: '#333333',
        strokeWidth: 1,
        brighter: 1,
        fillOpacity: 1
      }
    }
  }
};
