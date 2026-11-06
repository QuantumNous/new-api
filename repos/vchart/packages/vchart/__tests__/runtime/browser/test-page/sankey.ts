import { STATE_HOVER_REVERSE } from './../../../../cjs/compile/mark/interface.d';
import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const spec_string_value = {
    nodeKey: datum => datum.key,
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    linkWidth: 1000,
    nodeAlign: 'justify',
    iterations: 10,
    categoryField: 'key',
    valueField: 'value',
    // color: {
    //   field: 'color',
    //   type: 'ordinal',
    //   range: ['#5685f6', '#73cbe6', '#489e8e', '#82c882', '#e08c3d', '#f0d060', '#d4644f'],
    //   specified: {
    //     '231021145757116-当日': '#5685f6',
    //     '231021145757116-二级': '#73cbe6',
    //     '231021145757116-一级': '#489e8e',
    //     '231021145757116-标准级': '#82c882',
    //     '231021145757119-消费者': '#e08c3d',
    //     '231021145757119-别名2': '#f0d060',
    //     '231021145757119-别名1': '#d4644f'
    //   },
    //   domain: [
    //     '231021145757116-当日',
    //     '231021145757119-消费者',
    //     '231021145757116-二级',
    //     '231021145757119-别名2',
    //     '231021145757119-别名1',
    //     '231021145757116-一级',
    //     '231021145757116-标准级'
    //   ]
    // },
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '231021145757116': '当日',
                color: '当日',
                group: '231021145757116',
                key: '231021145757116-当日',
                name: '当日',
                type: 'node',
                value: '6',
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '231021145757119': '消费者',
                    color: '消费者',
                    group: '231021145757119',
                    key: '231021145757119-消费者',
                    name: '消费者',
                    type: 'node',
                    value: '3',
                    outDegree: 0,
                    inDegree: 4,
                    children: []
                  }
                  // {
                  //   '231021145757119': '别名1',
                  //   color: '别名1',
                  //   group: '231021145757119',
                  //   key: '231021145757119-别名1',
                  //   name: '别名1',
                  //   type: 'node',
                  //   value: '1.5',
                  //   outDegree: 0,
                  //   inDegree: 4,
                  //   children: []
                  // },
                  // {
                  //   '231021145757119': '别名2',
                  //   color: '别名2',
                  //   group: '231021145757119',
                  //   key: '231021145757119-别名2',
                  //   name: '别名2',
                  //   type: 'node',
                  //   value: '1.5',
                  //   outDegree: 0,
                  //   inDegree: 4,
                  //   children: []
                  // }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend-discrete',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: true,
      offset: 0,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'position',
            position: ['top', 'bottom']
          },
          {
            type: 'moveY',
            offset: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
          },
          {
            type: 'moveX',
            offset: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
          }
        ]
      },
      style: {
        fontSize: 12,
        zIndex: 400,
        fill: '#363839',
        stroke: 'rgba(255, 255, 255, 0.8)',
        strokeOpacity: 1,
        lineWidth: 1
      },
      limit: 200,
      interactive: false
    },
    background: 'rgba(255, 255, 255, 0)',
    emphasis: {
      enable: true,
      effect: 'related'
    },
    animation: false,
    hash: 'eb54f530b6e19145b528589f45681b05'
  };

  const spec_downstream = {
    type: 'sankey',
    nodeKey: datum => datum.key,
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    categoryField: 'key',
    valueField: 'value',
    link: {
      style: {
        pathType: 'smooth'
      },
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    color: {
      field: 'color',
      type: 'ordinal',
      range: [
        '#5685f6',
        '#73cbe6',
        '#489e8e',
        '#82c882',
        '#e08c3d',
        '#f0d060',
        '#d4644f',
        '#e09db7',
        '#7b51b3',
        '#8b9cd6',
        '#5685f6',
        '#73cbe6'
      ],
      specified: {
        '231021185251271-技术': '#5685f6',
        '231021185251271-家具': '#73cbe6',
        '231021185251271-办公用品': '#489e8e',
        '231021185251274-消费者': '#82c882',
        '231021185251274-小型企业': '#e08c3d',
        '231021185251274-公司': '#f0d060',
        '231021185251277-华东': '#d4644f',
        '231021185251277-华北': '#e09db7',
        '231021185251277-中南': '#7b51b3',
        '231021185251277-东北': '#8b9cd6',
        '231021185251277-西北': '#5685f6',
        '231021185251277-西南': '#73cbe6'
      },
      domain: [
        '231021185251271-技术',
        '231021185251274-消费者',
        '231021185251277-华东',
        '231021185251271-家具',
        '231021185251274-小型企业',
        '231021185251277-华北',
        '231021185251277-中南',
        '231021185251271-办公用品',
        '231021185251274-公司',
        '231021185251277-东北',
        '231021185251277-西北',
        '231021185251277-西南'
      ]
    },
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '231021185251271': '技术',
                color: '技术',
                group: '231021185251271',
                key: '231021185251271-技术',
                name: '技术',
                type: 'node',
                value: 7642,
                '231021185251280': 7642,
                outDegree: 18,
                inDegree: 0,
                children: [
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 1049,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 1049,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 313,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 313,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 392,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 392,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 198,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 198,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 745,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 745,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 300,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 300,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 427,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 427,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 343,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 343,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 75,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 75,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 707,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 707,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 104,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 104,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 671,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 671,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 387,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 387,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 260,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 260,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 200,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 200,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 1037,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 1037,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 45,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 45,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 389,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 389,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '231021185251271': '家具',
                color: '家具',
                group: '231021185251271',
                key: '231021185251271-家具',
                name: '家具',
                type: 'node',
                value: 8491,
                '231021185251280': 8491,
                outDegree: 18,
                inDegree: 0,
                children: [
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 194,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 194,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 1030,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 1030,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 131,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 131,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 58,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 58,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 561,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 561,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 739,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 739,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 594,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 594,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 100,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 100,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 452,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 452,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 278,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 278,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 399,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 399,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 279,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 279,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 661,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 661,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 436,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 436,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 279,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 279,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 1191,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 1191,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 765,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 765,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 344,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 344,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '231021185251271': '办公用品',
                color: '办公用品',
                group: '231021185251271',
                key: '231021185251271-办公用品',
                name: '办公用品',
                type: 'node',
                value: 21401,
                '231021185251280': 21401,
                outDegree: 18,
                inDegree: 0,
                children: [
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 1148,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 1148,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2802,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 2802,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 991,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 991,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 3326,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 3326,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 1797,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '中南',
                        color: '中南',
                        group: '231021185251277',
                        key: '231021185251277-中南',
                        name: '中南',
                        type: 'node',
                        value: 1797,
                        '231021185251280': 9700,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 1586,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 1586,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 638,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 638,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 1181,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 1181,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 976,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 976,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 593,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 593,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 120,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 120,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 537,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 537,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 581,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 581,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 1834,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华东',
                        color: '华东',
                        group: '231021185251277',
                        key: '231021185251277-华东',
                        name: '华东',
                        type: 'node',
                        value: 1834,
                        '231021185251280': 11041,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 313,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西北',
                        color: '西北',
                        group: '231021185251277',
                        key: '231021185251277-西北',
                        name: '西北',
                        type: 'node',
                        value: 313,
                        '231021185251280': 1785,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '公司',
                    color: '公司',
                    group: '231021185251274',
                    key: '231021185251274-公司',
                    name: '公司',
                    type: 'node',
                    value: 841,
                    '231021185251280': 11581,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '华北',
                        color: '华北',
                        group: '231021185251277',
                        key: '231021185251277-华北',
                        name: '华北',
                        type: 'node',
                        value: 841,
                        '231021185251280': 5146,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '消费者',
                    color: '消费者',
                    group: '231021185251274',
                    key: '231021185251274-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 1836,
                    '231021185251280': 19173,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '东北',
                        color: '东北',
                        group: '231021185251277',
                        key: '231021185251277-东北',
                        name: '东北',
                        type: 'node',
                        value: 1836,
                        '231021185251280': 6463,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  },
                  {
                    '231021185251274': '小型企业',
                    color: '小型企业',
                    group: '231021185251274',
                    key: '231021185251274-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 301,
                    '231021185251280': 6780,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '231021185251277': '西南',
                        color: '西南',
                        group: '231021185251277',
                        key: '231021185251277-西南',
                        name: '西南',
                        type: 'node',
                        value: 301,
                        '231021185251280': 3399,
                        outDegree: 0,
                        inDegree: 9,
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend-discrete',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: true,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 12,
        zIndex: 400,
        fill: '#363839',
        stroke: 'rgba(255, 255, 255, 0.8)',
        strokeOpacity: 1,
        lineWidth: 2
      },
      limit: 200,
      interactive: false
    },
    tooltip: {
      handler: {}
    },
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: 'a273eeacc0677cd75689ce49d2b61ad6'
  };

  const spec_adjacency = {
    type: 'sankey',
    data: [
      {
        values: [
          {
            nodes: [
              {
                name: 'Berlin'
              },
              {
                name: 'Job Applications'
              },
              {
                name: 'Barcelona'
              },
              {
                name: 'Madrid'
              },
              {
                name: 'Amsterdam'
              },
              {
                name: 'Paris'
              },
              {
                name: 'London'
              },
              {
                name: 'Munich'
              },
              {
                name: 'Brussels'
              },
              {
                name: 'Dubai'
              },
              {
                name: 'Dublin'
              },
              {
                name: 'Other Cities'
              },
              {
                name: 'No Response'
              },
              {
                name: 'Responded'
              },
              {
                name: 'Rejected'
              },
              {
                name: 'Interviewed'
              },
              {
                name: 'No Offer'
              },
              {
                name: 'Declined Offer'
              },
              {
                name: 'Accepted Offer'
              }
            ],
            links: [
              {
                source: 'Berlin',
                target: 'Job Applications',
                value: '102',
                color: '#dddddd'
              },
              {
                source: 'Barcelona',
                target: 'Job Applications',
                value: '39',
                color: '#dddddd'
              },
              {
                source: 'Madrid',
                target: 'Job Applications',
                value: 35,
                color: '#dddddd'
              },
              {
                source: 'Amsterdam',
                target: 'Job Applications',
                value: 15,
                color: '#dddddd'
              },
              {
                source: 'Paris',
                target: 'Job Applications',
                value: 14,
                color: '#dddddd'
              },
              {
                source: 'London',
                target: 'Job Applications',
                value: 6,
                color: '#dddddd'
              },
              {
                source: 'Munich',
                target: 'Job Applications',
                value: 5,
                color: '#dddddd'
              },
              {
                source: 'Brussels',
                target: 'Job Applications',
                value: 4,
                color: '#dddddd'
              },
              {
                source: 'Dubai',
                target: 'Job Applications',
                value: 3,
                color: '#dddddd'
              },
              {
                source: 'Dublin',
                target: 'Job Applications',
                value: 3,
                color: '#dddddd'
              },
              {
                source: 'Other Cities',
                target: 'Job Applications',
                value: 12,
                color: '#dddddd'
              },
              {
                source: 'Job Applications',
                target: 'No Response',
                value: 189,
                color: '#dddddd'
              },
              {
                source: 'Job Applications',
                target: 'Responded',
                value: 49,
                color: 'orange'
              },
              {
                source: 'Responded',
                target: 'Rejected',
                value: 38,
                color: '#dddddd'
              },
              {
                source: 'Responded',
                target: 'Interviewed',
                value: 11,
                color: 'orange'
              },
              {
                source: 'Interviewed',
                target: 'No Offer',
                value: 8,
                color: '#dddddd'
              },
              {
                source: 'Interviewed',
                target: 'Declined Offer',
                value: 2,
                color: '#dddddd'
              },
              {
                source: 'Interviewed',
                target: 'Accepted Offer',
                value: 1,
                color: 'orange'
              }
            ]
          }
        ]
      }
    ],
    categoryField: 'name',
    valueField: 'value',
    sourceField: 'source',
    targetField: 'target',

    nodeAlign: 'justify',
    nodeGap: 8,
    nodeWidth: 15,
    minNodeHeight: 4,
    nodeKey: datum => datum.name,
    iterations: 20,

    title: {
      text: 'Job application process'
    },

    label: {
      visible: true,
      style: {
        fontSize: 10,
        fill: 'black'
      },
      state: {
        blur: {
          fill: '#e8e8e8',
          fillOpacity: 0.15
        }
      }
    },

    node: {
      style: {
        fill: '#b9b9b9',
        stroke: 'white',
        lineWidth: 1,
        strokeOpacity: 1
      },
      state: {
        hover: {
          fill: 'red',
          fillOpacity: 1
        },
        selected: {
          fill: '#dddddd',
          stroke: '#333333',
          lineWidth: 1,
          fillOpacity: 1
        },
        blur: {
          fillOpacity: 0.05,
          strokeOpacity: 0.05
        }
      }
    },

    link: {
      style: {
        fill: data => {
          return data.color ?? data.datum.color;
        },
        fillOpacity: 1
      },
      state: {
        hover: {
          fillOpacity: 1
        },
        selected: {
          fillOpacity: 1
        },
        blur: {
          fillOpacity: 0.05
        }
      }
    },

    select: false,

    emphasis: {
      enable: true,
      effect: 'adjacency'
    }
  };

  const spec1 = {
    type: 'sankey',
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                // value: 100,
                name: 'A',
                children: [
                  {
                    name: 'top',
                    // value: 40,
                    children: [
                      { name: '00', value: 15 },
                      { name: '01', value: 10 },
                      { name: '02', value: 10 }
                    ]
                  },
                  {
                    name: 'middle',
                    // value: 30,
                    children: [
                      { name: '00', value: 10 },
                      { name: '01', value: 10 },
                      { name: '02', value: 10 }
                    ]
                  },
                  {
                    name: 'bottom',
                    value: 30,
                    children: [
                      { name: '00', value: 10 },
                      { name: '01', value: 10 },
                      { name: '02', value: 10 }
                    ]
                  }
                ]
              }
              // {
              //   // value: 80,
              //   name: 'B',
              //   children: [
              //     {
              //       name: 'top',
              //       // value: 40,
              //       children: [
              //         { name: '00', value: 100 },
              //         { name: '01', value: 40 }
              //       ]
              //     },
              //     {
              //       name: 'middle',
              //       value: 10
              //     },
              //     {
              //       name: 'bottom',
              //       value: 30
              //     }
              //   ]
              // },
              // {
              //   value: 50,
              //   name: 'C',
              //   children: [
              //     {
              //       name: 'top',
              //       value: 20
              //     },
              //     {
              //       name: 'middle',
              //       value: 20
              //     },
              //     {
              //       name: 'bottom',
              //       value: 10
              //     }
              //   ]
              // }
            ]
          }
        ]
      }
    ],
    crossNodeAlign: 'start',
    categoryField: 'name',
    valueField: 'value',
    color: {
      field: 'color',
      type: 'ordinal',
      domain: ['C', 'A', 'top', '00', '01', '02', 'middle', 'bottom', 'B'],
      // domain: ['A', 'top', '00', '01', '02', 'middle', 'bottom', 'B', 'C'],
      range: ['#fd7f6f', '#7eb0d5', '#b2e061', '#bd7ebe', '#ffb55a', '#ffee65', '#beb9db', '#fdcce5', '#8bd3c7']
    },
    nodeAlign: 'left',
    nodeGap: 8,
    nodeWidth: 10,
    linkWidth: 1000,
    overflow: 'scroll',
    minNodeHeight: 4,
    nodeKey: datum => datum.name,

    label: {
      visible: true,
      formatMethod: (text, datum) => {
        // console.log('text', text);
        // console.log('datum', datum);
        return datum.name + '-' + datum.value;
      },
      state: {
        // blur: {
        //   fill: '#e8e8e8',
        //   fillOpacity: 0.15
        // }
      }
    },

    legends: {
      visible: true
    },

    node: {
      // state: {
      //   hover: {
      //     fill: 'red'
      //   },
      //   blur: {
      //     fill: '#e8e8e8',
      //     fillOpacity: 0.15
      //   }
      // }
    },

    link: {
      // state: {
      //   selected: {
      //     backgroundStyle: { fill: '#e8e8e8' }
      //   },
      //   hover: {
      //     stroke: '#000000'
      //   },
      //   blur: {
      //     fill: '#e8e8e8'
      //   }
      // }
    }

    // emphasis: {
    //   enable: true,
    //   effect: 'related'
    // }
  };

  const data = [
    [
      {
        nodes: [
          {
            name: 'Berlin'
          },
          {
            name: 'Job Applications'
          },
          {
            name: 'Barcelona'
          },
          {
            name: 'Madrid'
          },
          {
            name: 'Amsterdam'
          },
          {
            name: 'Paris'
          },
          {
            name: 'London'
          },
          {
            name: 'Munich'
          },
          {
            name: 'Brussels'
          },
          {
            name: 'Dubai'
          },
          {
            name: 'Dublin'
          },
          {
            name: 'Other Cities'
          },
          {
            name: 'No Response'
          },
          {
            name: 'Responded'
          },
          {
            name: 'Rejected'
          },
          {
            name: 'Interviewed'
          },
          {
            name: 'No Offer'
          },
          {
            name: 'Declined Offer'
          },
          {
            name: 'Accepted Offer'
          }
        ],
        links: [
          {
            source: 'Berlin',
            target: 'Job Applications',
            value: 102,
            color: '#dddddd'
          },
          {
            source: 'Barcelona',
            target: 'Job Applications',
            value: 39,
            color: '#dddddd'
          },
          {
            source: 'Madrid',
            target: 'Job Applications',
            value: 35,
            color: '#dddddd'
          },
          {
            source: 'Amsterdam',
            target: 'Job Applications',
            value: 15,
            color: '#dddddd'
          },
          {
            source: 'Paris',
            target: 'Job Applications',
            value: 14,
            color: '#dddddd'
          },
          {
            source: 'London',
            target: 'Job Applications',
            value: 6,
            color: '#dddddd'
          },
          {
            source: 'Munich',
            target: 'Job Applications',
            value: 5,
            color: '#dddddd'
          },
          {
            source: 'Brussels',
            target: 'Job Applications',
            value: 4,
            color: '#dddddd'
          },
          {
            source: 'Dubai',
            target: 'Job Applications',
            value: 3,
            color: '#dddddd'
          },
          {
            source: 'Dublin',
            target: 'Job Applications',
            value: 3,
            color: '#dddddd'
          },
          {
            source: 'Other Cities',
            target: 'Job Applications',
            value: 12,
            color: '#dddddd'
          },
          {
            source: 'Job Applications',
            target: 'No Response',
            value: 189,
            color: '#dddddd'
          },
          {
            source: 'Job Applications',
            target: 'Responded',
            value: 49,
            color: 'orange'
          },
          {
            source: 'Responded',
            target: 'Rejected',
            value: 38,
            color: '#dddddd'
          },
          {
            source: 'Responded',
            target: 'Interviewed',
            value: 11,
            color: 'orange'
          },
          {
            source: 'Interviewed',
            target: 'No Offer',
            value: 8,
            color: '#dddddd'
          },
          {
            source: 'Interviewed',
            target: 'Declined Offer',
            value: 2,
            color: '#dddddd'
          },
          {
            source: 'Interviewed',
            target: 'Accepted Offer',
            value: 1,
            color: 'orange'
          }
        ]
      }
    ],
    [
      {
        nodes: [
          {
            name: 'Berlin'
          },
          {
            name: 'Job Applications'
          },
          {
            name: 'Barcelona'
          },
          {
            name: 'Madrid'
          },
          {
            name: 'Amsterdam'
          },
          {
            name: 'Paris'
          },
          {
            name: 'London'
          },
          {
            name: 'Munich'
          },
          {
            name: 'Brussels'
          },
          {
            name: 'Dubai'
          },
          {
            name: 'Dublin'
          },
          {
            name: 'Other Cities'
          },
          {
            name: 'No Response'
          },
          {
            name: 'Responded'
          },
          {
            name: 'Rejected'
          },
          {
            name: 'Interviewed'
          },
          {
            name: 'No Offer'
          },
          {
            name: 'Declined Offer'
          },
          {
            name: 'Accepted Offer'
          }
        ],
        links: [
          {
            source: 'Berlin',
            target: 'Job Applications',
            value: 102,
            color: '#dddddd'
          },
          {
            source: 'Barcelona',
            target: 'Job Applications',
            value: 39,
            color: '#dddddd'
          },
          {
            source: 'Madrid',
            target: 'Job Applications',
            value: 35,
            color: '#dddddd'
          },
          {
            source: 'Amsterdam',
            target: 'Job Applications',
            value: 15,
            color: '#dddddd'
          },
          {
            source: 'Paris',
            target: 'Job Applications',
            value: 14,
            color: '#dddddd'
          },
          {
            source: 'London',
            target: 'Job Applications',
            value: 6,
            color: '#dddddd'
          },
          {
            source: 'Munich',
            target: 'Job Applications',
            value: 5,
            color: '#dddddd'
          },
          {
            source: 'Brussels',
            target: 'Job Applications',
            value: 4,
            color: '#dddddd'
          },
          {
            source: 'Dubai',
            target: 'Job Applications',
            value: 3,
            color: '#dddddd'
          },
          {
            source: 'Dublin',
            target: 'Job Applications',
            value: 3,
            color: '#dddddd'
          },
          {
            source: 'Other Cities',
            target: 'Job Applications',
            value: 12,
            color: '#dddddd'
          },
          {
            source: 'Job Applications',
            target: 'No Response',
            value: 189,
            color: '#dddddd'
          },
          {
            source: 'Job Applications',
            target: 'Responded',
            value: 49,
            color: 'orange'
          },
          {
            source: 'Responded',
            target: 'Rejected',
            value: 8,
            color: '#dddddd'
          },
          {
            source: 'Responded',
            target: 'Interviewed',
            value: 2,
            color: 'orange'
          },
          {
            source: 'Interviewed',
            target: 'No Offer',
            value: 38,
            color: '#dddddd'
          },
          {
            source: 'Interviewed',
            target: 'Declined Offer',
            value: 1,
            color: '#dddddd'
          },
          {
            source: 'Interviewed',
            target: 'Accepted Offer',
            value: 1,
            color: 'orange'
          }
        ]
      }
    ],
    [
      {
        nodes: [
          {
            name: 'Berlin'
          },
          {
            name: 'Job Applications'
          },
          {
            name: 'Barcelona'
          },
          {
            name: 'Madrid'
          },
          {
            name: 'Amsterdam'
          },
          {
            name: 'Paris'
          },
          {
            name: 'London'
          },
          {
            name: 'Munich'
          },
          {
            name: 'Brussels'
          },
          {
            name: 'Dubai'
          },
          {
            name: 'Dublin'
          },
          {
            name: 'Other Cities'
          },
          {
            name: 'No Response'
          },
          {
            name: 'Responded'
          },
          {
            name: 'Rejected'
          },
          {
            name: 'Interviewed'
          },
          {
            name: 'No Offer'
          },
          {
            name: 'Declined Offer'
          },
          {
            name: 'Accepted Offer'
          }
        ],
        links: [
          {
            source: 'Berlin',
            target: 'Job Applications',
            value: 102,
            color: '#dddddd'
          },
          {
            source: 'Barcelona',
            target: 'Job Applications',
            value: 39,
            color: '#dddddd'
          },
          {
            source: 'Madrid',
            target: 'Job Applications',
            value: 35,
            color: '#dddddd'
          },
          {
            source: 'Amsterdam',
            target: 'Job Applications',
            value: 15,
            color: '#dddddd'
          },
          {
            source: 'Paris',
            target: 'Job Applications',
            value: 14,
            color: '#dddddd'
          },
          {
            source: 'London',
            target: 'Job Applications',
            value: 6,
            color: '#dddddd'
          },
          {
            source: 'Munich',
            target: 'Job Applications',
            value: 5,
            color: '#dddddd'
          },
          {
            source: 'Brussels',
            target: 'Job Applications',
            value: 4,
            color: '#dddddd'
          },
          {
            source: 'Dubai',
            target: 'Job Applications',
            value: 3,
            color: '#dddddd'
          },
          {
            source: 'Dublin',
            target: 'Job Applications',
            value: 3,
            color: '#dddddd'
          },
          {
            source: 'Other Cities',
            target: 'Job Applications',
            value: 12,
            color: '#dddddd'
          },
          {
            source: 'Job Applications',
            target: 'No Response',
            value: 189,
            color: '#dddddd'
          },
          {
            source: 'Job Applications',
            target: 'Responded',
            value: 49,
            color: 'orange'
          },
          {
            source: 'Responded',
            target: 'Rejected',
            value: 38,
            color: '#dddddd'
          },
          {
            source: 'Responded',
            target: 'Interviewed',
            value: 11,
            color: 'orange'
          },
          {
            source: 'Interviewed',
            target: 'No Offer',
            value: 80,
            color: '#dddddd'
          },
          {
            source: 'Interviewed',
            target: 'Declined Offer',
            value: 20,
            color: '#dddddd'
          },
          {
            source: 'Interviewed',
            target: 'Accepted Offer',
            value: 10,
            color: 'red'
          }
        ]
      }
    ]
  ];
  const createData = () => {
    return data.map(values => {
      return {
        data: {
          id: 'data',
          values: values
        }
      };
    });
  };
  const specs = createData();

  // console.log(specs, specs[0].data);

  const spec = {
    type: 'sankey',
    data: [specs[0].data],
    categoryField: 'name',
    valueField: 'value',
    sourceField: 'source',
    targetField: 'target',

    nodeAlign: 'justify',
    nodeGap: 8,
    nodeWidth: 15,
    minNodeHeight: 4,
    nodeKey: datum => datum.name,
    iterations: 20,

    title: {
      text: 'Job application process'
    },

    label: {
      visible: true,
      style: {
        fontSize: 10,
        fill: 'black'
      },
      state: {
        blur: {
          fill: '#e8e8e8',
          fillOpacity: 0.15
        }
      }
    },

    node: {
      style: {
        fill: '#b9b9b9',
        stroke: 'white',
        lineWidth: 1,
        strokeOpacity: 1
      },
      state: {
        custom_unSelected: {
          fill: 'red',
          fillOpacity: 0.05
        }
      }
    },

    link: {
      style: {
        fill: data => {
          return data.color ?? data.datum.color;
        },
        fillOpacity: 1
      },
      state: {
        custom_unSelected: {
          fill: 'red',
          fillOpacity: 0.05
        }
      }
    }
  };

  const spec2 = {
    type: 'sankey',
    data: [
      {
        values: [
          {
            nodes: [
              { nodeName: "Agricultural 'waste'" },
              { nodeName: 'Bio-conversion' },
              { nodeName: 'Liquid' },
              { nodeName: 'Losses' },
              { nodeName: 'Solid' },
              { nodeName: 'Gas' },
              { nodeName: 'Biofuel imports' },
              { nodeName: 'Biomass imports' },
              { nodeName: 'Coal imports' },
              { nodeName: 'Coal' },
              { nodeName: 'Coal reserves' },
              { nodeName: 'District heating' },
              { nodeName: 'Industry' },
              { nodeName: 'Heating and cooling - commercial' },
              { nodeName: 'Heating and cooling - homes' },
              { nodeName: 'Electricity grid' },
              { nodeName: 'Over generation / exports' },
              { nodeName: 'H2 conversion' },
              { nodeName: 'Road transport' },
              { nodeName: 'Agriculture' },
              { nodeName: 'Rail transport' },
              { nodeName: 'Lighting & appliances - commercial' },
              { nodeName: 'Lighting & appliances - homes' },
              { nodeName: 'Gas imports' },
              { nodeName: 'Ngas' },
              { nodeName: 'Gas reserves' },
              { nodeName: 'Thermal generation' },
              { nodeName: 'Geothermal' },
              { nodeName: 'H2' },
              { nodeName: 'Hydro' },
              { nodeName: 'International shipping' },
              { nodeName: 'Domestic aviation' },
              { nodeName: 'International aviation' },
              { nodeName: 'National navigation' },
              { nodeName: 'Marine algae' },
              { nodeName: 'Nuclear' },
              { nodeName: 'Oil imports' },
              { nodeName: 'Oil' },
              { nodeName: 'Oil reserves' },
              { nodeName: 'Other waste' },
              { nodeName: 'Pumped heat' },
              { nodeName: 'Solar PV' },
              { nodeName: 'Solar Thermal' },
              { nodeName: 'Solar' },
              { nodeName: 'Tidal' },
              { nodeName: 'UK land based bioenergy' },
              { nodeName: 'Wave' },
              { nodeName: 'Wind' }
            ],
            links: [
              { from: 0, to: 1, value: 124.729 },
              { from: 1, to: 2, value: 0.597 },
              { from: 1, to: 3, value: 26.862 },
              { from: 1, to: 4, value: 280.322 },
              { from: 1, to: 5, value: 81.144 },
              { from: 6, to: 2, value: 35 },
              { from: 7, to: 4, value: 35 },
              { from: 8, to: 9, value: 11.606 },
              { from: 10, to: 9, value: 63.965 },
              { from: 9, to: 4, value: 75.571 },
              { from: 11, to: 12, value: 10.639 },
              { from: 11, to: 13, value: 22.505 },
              { from: 11, to: 14, value: 46.184 },
              { from: 15, to: 16, value: 104.453 },
              { from: 15, to: 14, value: 113.726 },
              { from: 15, to: 17, value: 27.14 },
              { from: 15, to: 12, value: 342.165 },
              { from: 15, to: 18, value: 37.797 },
              { from: 15, to: 19, value: 4.412 },
              { from: 15, to: 13, value: 40.858 },
              { from: 15, to: 3, value: 56.691 },
              { from: 15, to: 20, value: 7.863 },
              { from: 15, to: 21, value: 90.008 },
              { from: 15, to: 22, value: 93.494 },
              { from: 23, to: 24, value: 40.719 },
              { from: 25, to: 24, value: 82.233 },
              { from: 5, to: 13, value: 0.129 },
              { from: 5, to: 3, value: 1.401 },
              { from: 5, to: 26, value: 151.891 },
              { from: 5, to: 19, value: 2.096 },
              { from: 5, to: 12, value: 48.58 },
              { from: 27, to: 15, value: 7.013 },
              { from: 17, to: 28, value: 20.897 },
              { from: 17, to: 3, value: 6.242 },
              { from: 28, to: 18, value: 20.897 },
              { from: 29, to: 15, value: 6.995 },
              { from: 2, to: 12, value: 121.066 },
              { from: 2, to: 30, value: 128.69 },
              { from: 2, to: 18, value: 135.835 },
              { from: 2, to: 31, value: 14.458 },
              { from: 2, to: 32, value: 206.267 },
              { from: 2, to: 19, value: 3.64 },
              { from: 2, to: 33, value: 33.218 },
              { from: 2, to: 20, value: 4.413 },
              { from: 34, to: 1, value: 4.375 },
              { from: 24, to: 5, value: 122.952 },
              { from: 35, to: 26, value: 839.978 },
              { from: 36, to: 37, value: 504.287 },
              { from: 38, to: 37, value: 107.703 },
              { from: 37, to: 2, value: 611.99 },
              { from: 39, to: 4, value: 56.587 },
              { from: 39, to: 1, value: 77.81 },
              { from: 40, to: 14, value: 193.026 },
              { from: 40, to: 13, value: 70.672 },
              { from: 41, to: 15, value: 59.901 },
              { from: 42, to: 14, value: 19.263 },
              { from: 43, to: 42, value: 19.263 },
              { from: 43, to: 41, value: 59.901 },
              { from: 4, to: 19, value: 0.882 },
              { from: 4, to: 26, value: 400.12 },
              { from: 4, to: 12, value: 46.477 },
              { from: 26, to: 15, value: 525.531 },
              { from: 26, to: 3, value: 787.129 },
              { from: 26, to: 11, value: 79.329 },
              { from: 44, to: 15, value: 9.452 },
              { from: 45, to: 1, value: 182.01 },
              { from: 46, to: 15, value: 19.013 },
              { from: 47, to: 15, value: 289.366 }
            ]
          }
        ]
      }
    ],
    categoryField: 'nodeName',
    valueField: 'value',
    sourceField: 'from',
    targetField: 'to',

    nodeAlign: 'justify',
    nodeGap: 8,
    nodeWidth: 10,
    minNodeHeight: 4,
    crossNodeAlign: 'parent',

    title: {
      text: 'How energy is converted or transmitted before being consumed or lost',
      subtext: 'Data: Department of Energy & Climate Change via Tom Counsell',
      subtextStyle: {
        fontSize: 12
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
          lineWidth: 1,
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
          lineWidth: 1,
          brighter: 1,
          fillOpacity: 1
        }
      }
    },
    emphasis: {
      enable: true,
      effect: 'adjacency'
    }
  };

  const data1 = [
    {
      nodes: [
        { name: 'Bight of Benin', category: 'Bight' },
        { name: 'Brazil', category: 'Brazil' },
        { name: 'Bight of Biafra and Gulf of Guinea islands', category: 'Bight' },
        { name: 'Gold Coast', category: 'Gold' },
        { name: 'Others Dep.', category: 'Others' },
        { name: 'Senegambia and offshore Atlantic', category: 'Senegambia' },
        { name: 'Sierra Leone e Windward Coast', category: 'Sierra' },
        { name: 'Southeast Africa and Indian Ocean islands', category: 'Southeast' },
        { name: 'West Central Africa and St. Helena', category: 'West' },
        { name: 'Caribbean', category: 'Caribbean' },
        { name: 'Mainland North America', category: 'Mainland' },
        { name: 'Others Arr', category: 'Others' },
        { name: 'Spanish American Mainland', category: 'Spanish' }
      ],
      links: [
        { target: 'Brazil', source: 'Bight of Benin', value: 733769 },
        { target: 'Brazil', source: 'Bight of Biafra and Gulf of Guinea islands', value: 98256 },
        { target: 'Brazil', source: 'Gold Coast', value: 40507 },
        { target: 'Brazil', source: 'Others Dep.', value: 18627 },
        { target: 'Brazil', source: 'Senegambia and offshore Atlantic', value: 86001 },
        { target: 'Brazil', source: 'Sierra Leone e Windward Coast', value: 5409 },
        { target: 'Brazil', source: 'Southeast Africa and Indian Ocean islands', value: 232940 },
        { target: 'Brazil', source: 'West Central Africa and St. Helena', value: 1818611 },
        { target: 'Caribbean', source: 'Bight of Benin', value: 494753 },
        { target: 'Caribbean', source: 'Bight of Biafra and Gulf of Guinea islands', value: 678927 },
        { target: 'Caribbean', source: 'Gold Coast', value: 517280 },
        { target: 'Caribbean', source: 'Others Dep.', value: 192389 },
        { target: 'Caribbean', source: 'Senegambia and offshore Atlantic', value: 144125 },
        { target: 'Caribbean', source: 'Sierra Leone e Windward Coast', value: 284412 },
        { target: 'Caribbean', source: 'Southeast Africa and Indian Ocean islands', value: 57138 },
        { target: 'Caribbean', source: 'West Central Africa and St. Helena', value: 793963 },
        { target: 'Mainland North America', source: 'Bight of Benin', value: 7153 },
        { target: 'Mainland North America', source: 'Bight of Biafra and Gulf of Guinea islands', value: 39389 },
        { target: 'Mainland North America', source: 'Gold Coast', value: 26918 },
        { target: 'Mainland North America', source: 'Others Dep.', value: 12532 },
        { target: 'Mainland North America', source: 'Senegambia and offshore Atlantic', value: 49118 },
        { target: 'Mainland North America', source: 'Sierra Leone e Windward Coast', value: 40366 },
        { target: 'Mainland North America', source: 'Southeast Africa and Indian Ocean islands', value: 3958 },
        { target: 'Mainland North America', source: 'West Central Africa and St. Helena', value: 62966 },
        { target: 'Others Arr', source: 'Bight of Benin', value: 40607 },
        { target: 'Others Arr', source: 'Bight of Biafra and Gulf of Guinea islands', value: 34687 },
        { target: 'Others Arr', source: 'Gold Coast', value: 2108 },
        { target: 'Others Arr', source: 'Others Dep.', value: 1499 },
        { target: 'Others Arr', source: 'Senegambia and offshore Atlantic', value: 8435 },
        { target: 'Others Arr', source: 'Sierra Leone e Windward Coast', value: 12793 },
        { target: 'Others Arr', source: 'Southeast Africa and Indian Ocean islands', value: 9924 },
        { target: 'Others Arr', source: 'West Central Africa and St. Helena', value: 50046 },
        { target: 'Spanish American Mainland', source: 'Bight of Benin', value: 15822 },
        { target: 'Spanish American Mainland', source: 'Bight of Biafra and Gulf of Guinea islands', value: 13700 },
        { target: 'Spanish American Mainland', source: 'Gold Coast', value: 5030 },
        { target: 'Spanish American Mainland', source: 'Others Dep.', value: 5155 },
        { target: 'Spanish American Mainland', source: 'Senegambia and offshore Atlantic', value: 44889 },
        { target: 'Spanish American Mainland', source: 'Sierra Leone e Windward Coast', value: 326 },
        { target: 'Spanish American Mainland', source: 'Southeast Africa and Indian Ocean islands', value: 14327 },
        { target: 'Spanish American Mainland', source: 'West Central Africa and St. Helena', value: 131837 }
      ],
      units: 'Escravos'
    }
  ];

  const spec3 = {
    type: 'sankey',
    data: [
      {
        name: 'data',
        values: data1
      }
    ],
    categoryField: 'name',
    valueField: 'value',
    sourceField: 'source',
    targetField: 'target',
    colorField: 'type',
    nodeKey: datum => datum.name,

    label: {
      visible: true,
      style: {
        fontSize: 12,
        fill: '#000000',
        limit: 10000
      }
    },

    node: {
      state: {
        hover: {
          fill: 'red'
        },
        blur: {
          fill: '#e8e8e8',
          fillOpacity: 0.15
        }
      }
    },

    link: {
      style: {
        fillOpacity: 0.1
      },
      state: {
        hover: {
          fillOpacity: 0.4
        },
        blur: {
          fill: '#e8e8e8'
        }
      }
    },
    emphasis: {
      enable: true,
      trigger: 'selected',
      effect: 'adjacency'
    },
    title: {
      text: 'From Where in Africa Were the Slaves Who Landed in Va.?',
      subtext: 'Source: https://observablehq.com/@luiztheodoro/sankey-d3',
      subtextStyle: {
        fontSize: 12
      }
    }
  };

  const spec4 = {
    type: 'sankey',
    data: [
      {
        name: 'sankeyChart',
        values: [
          {
            id: 'nodes',
            values: [
              { nodeName: "Agricultural 'waste'" },
              { nodeName: 'Bio-conversion' },
              { nodeName: 'Liquid' },
              { nodeName: 'Losses' },
              { nodeName: 'Solid' },
              { nodeName: 'Gas' },
              { nodeName: 'Biofuel imports' },
              { nodeName: 'Biomass imports' },
              { nodeName: 'Coal imports' },
              { nodeName: 'Coal' },
              { nodeName: 'Coal reserves' },
              { nodeName: 'District heating' },
              { nodeName: 'Industry' },
              { nodeName: 'Heating and cooling - commercial' },
              { nodeName: 'Heating and cooling - homes' },
              { nodeName: 'Electricity grid' },
              { nodeName: 'Over generation / exports' },
              { nodeName: 'H2 conversion' },
              { nodeName: 'Road transport' },
              { nodeName: 'Agriculture' },
              { nodeName: 'Rail transport' },
              { nodeName: 'Lighting & appliances - commercial' },
              { nodeName: 'Lighting & appliances - homes' },
              { nodeName: 'Gas imports' },
              { nodeName: 'Ngas' },
              { nodeName: 'Gas reserves' },
              { nodeName: 'Thermal generation' },
              { nodeName: 'Geothermal' },
              { nodeName: 'H2' },
              { nodeName: 'Hydro' },
              { nodeName: 'International shipping' },
              { nodeName: 'Domestic aviation' },
              { nodeName: 'International aviation' },
              { nodeName: 'National navigation' },
              { nodeName: 'Marine algae' },
              { nodeName: 'Nuclear' },
              { nodeName: 'Oil imports' },
              { nodeName: 'Oil' },
              { nodeName: 'Oil reserves' },
              { nodeName: 'Other waste' },
              { nodeName: 'Pumped heat' },
              { nodeName: 'Solar PV' },
              { nodeName: 'Solar Thermal' },
              { nodeName: 'Solar' },
              { nodeName: 'Tidal' },
              { nodeName: 'UK land based bioenergy' },
              { nodeName: 'Wave' },
              { nodeName: 'Wind' }
            ]
          },
          {
            id: 'links',
            values: [
              { source: 0, target: 1, value: 124.729 },
              { source: 1, target: 2, value: 0.597 },
              { source: 1, target: 3, value: 26.862 },
              { source: 1, target: 4, value: 280.322 },
              { source: 1, target: 5, value: 81.144 },
              { source: 6, target: 2, value: 35 },
              { source: 7, target: 4, value: 35 },
              { source: 8, target: 9, value: 11.606 },
              { source: 10, target: 9, value: 63.965 },
              { source: 9, target: 4, value: 75.571 },
              { source: 11, target: 12, value: 10.639 },
              { source: 11, target: 13, value: 22.505 },
              { source: 11, target: 14, value: 46.184 },
              { source: 15, target: 16, value: 104.453 },
              { source: 15, target: 14, value: 113.726 },
              { source: 15, target: 17, value: 27.14 },
              { source: 15, target: 12, value: 342.165 },
              { source: 15, target: 18, value: 37.797 },
              { source: 15, target: 19, value: 4.412 },
              { source: 15, target: 13, value: 40.858 },
              { source: 15, target: 3, value: 56.691 },
              { source: 15, target: 20, value: 7.863 },
              { source: 15, target: 21, value: 90.008 },
              { source: 15, target: 22, value: 93.494 },
              { source: 23, target: 24, value: 40.719 },
              { source: 25, target: 24, value: 82.233 },
              { source: 5, target: 13, value: 0.129 },
              { source: 5, target: 3, value: 1.401 },
              { source: 5, target: 26, value: 151.891 },
              { source: 5, target: 19, value: 2.096 },
              { source: 5, target: 12, value: 48.58 },
              { source: 27, target: 15, value: 7.013 },
              { source: 17, target: 28, value: 20.897 },
              { source: 17, target: 3, value: 6.242 },
              { source: 28, target: 18, value: 20.897 },
              { source: 29, target: 15, value: 6.995 },
              { source: 2, target: 12, value: 121.066 },
              { source: 2, target: 30, value: 128.69 },
              { source: 2, target: 18, value: 135.835 },
              { source: 2, target: 31, value: 14.458 },
              { source: 2, target: 32, value: 206.267 },
              { source: 2, target: 19, value: 3.64 },
              { source: 2, target: 33, value: 33.218 },
              { source: 2, target: 20, value: 4.413 },
              { source: 34, target: 1, value: 4.375 },
              { source: 24, target: 5, value: 122.952 },
              { source: 35, target: 26, value: 839.978 },
              { source: 36, target: 37, value: 504.287 },
              { source: 38, target: 37, value: 107.703 },
              { source: 37, target: 2, value: 611.99 },
              { source: 39, target: 4, value: 56.587 },
              { source: 39, target: 1, value: 77.81 },
              { source: 40, target: 14, value: 193.026 },
              { source: 40, target: 13, value: 70.672 },
              { source: 41, target: 15, value: 59.901 },
              { source: 42, target: 14, value: 19.263 },
              { source: 43, target: 42, value: 19.263 },
              { source: 43, target: 41, value: 59.901 },
              { source: 4, target: 19, value: 0.882 },
              { source: 4, target: 26, value: 400.12 },
              { source: 4, target: 12, value: 46.477 },
              { source: 26, target: 15, value: 525.531 },
              { source: 26, target: 3, value: 787.129 },
              { source: 26, target: 11, value: 79.329 },
              { source: 44, target: 15, value: 9.452 },
              { source: 45, target: 1, value: 182.01 },
              { source: 46, target: 15, value: 19.013 },
              { source: 47, target: 15, value: 289.366 }
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

    title: {
      text: 'How energy is converted or transmitted before being consumed or lost',
      subtext: 'Data: Department of Energy & Climate Change via Tom Counsell',
      subtextStyle: {
        fontSize: 12
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
          lineWidth: 1,
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
          lineWidth: 1,
          brighter: 1,
          fillOpacity: 1
        }
      }
    }
  };

  const spec_987 = {
    nodeKey: d => d.color,
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    categoryField: 'color',
    valueField: 'value',
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230918165049142': '技术',
                color: '技术',
                group: '230918165049142',
                key: '230918165049142-技术',
                name: '技术',
                type: 'node',
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  }
                ]
              },
              {
                '230918165049142': '办公用品',
                color: '办公用品',
                group: '230918165049142',
                key: '230918165049142-办公用品',
                name: '办公用品',
                type: 'node',
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  }
                ]
              },
              {
                '230918165049142': 'https://bing.com',
                color: 'https://bing.com',
                group: '230918165049142',
                key: '230918165049142-https://bing.com',
                name: 'https://bing.com',
                type: 'node',
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '当日',
                    color: '当日',
                    group: '230918181950013',
                    key: '230918181950013-当日',
                    name: '当日',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '二级',
                    color: '二级',
                    group: '230918181950013',
                    key: '230918181950013-二级',
                    name: '二级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '一级',
                    color: '一级',
                    group: '230918181950013',
                    key: '230918181950013-一级',
                    name: '一级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  },
                  {
                    '230918181950013': '标准级',
                    color: '标准级',
                    group: '230918181950013',
                    key: '230918181950013-标准级',
                    name: '标准级',
                    type: 'node',
                    outDegree: 9,
                    inDegree: 9,
                    children: [
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '公司',
                        color: '公司',
                        group: '230918182939028',
                        key: '230918182939028-公司',
                        name: '公司',
                        type: 'node',
                        value: 5152793.296570778,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '小型企业',
                        color: '小型企业',
                        group: '230918182939028',
                        key: '230918182939028-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 12
                      },
                      {
                        '230918182939028': '消费者',
                        color: '消费者',
                        group: '230918182939028',
                        key: '230918182939028-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 8025072.194172859,
                        outDegree: 0,
                        inDegree: 12
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 677,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 2,
            left: 3,
            right: 2
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend',
        orient: 'right',
        position: 'start',
        layoutType: 'normal',
        visible: true,
        maxCol: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 60,
        pager: {
          layout: 'horizontal',
          padding: {
            left: -18
          },
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 0,
          bottom: 0,
          left: 16,
          right: 0
        }
      }
    ],
    label: {
      visible: true,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 12,
        zIndex: 100
      },
      color: '#363839',
      strokeOpacity: 1,
      stroke: 'rgba(255, 255, 255, 0.8)',
      strokeWidth: 2,
      limit: 200
    },
    tooltip: {
      handler: {}
    },
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    link: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: 'c39ef7cbc3392509bcc7845afa6f7d9c'
  };

  const spec_992 = {
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 10,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    categoryField: 'key',
    nodeKey: d => d['key'],
    valueField: 'value',
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230919103714016': '当日',
                color: '当日',
                group: '230919103714016',
                key: '230919103714016-当日',
                name: '当日',
                type: 'node',
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919103714019': '消费者',
                    color: '消费者',
                    group: '230919103714019',
                    key: '230919103714019-消费者',
                    name: '消费者',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '公司',
                    color: '公司',
                    group: '230919103714019',
                    key: '230919103714019-公司',
                    name: '公司',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '小型企业',
                    color: '小型企业',
                    group: '230919103714019',
                    key: '230919103714019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  }
                ]
              },
              {
                '230919103714016': '二级',
                color: '二级',
                group: '230919103714016',
                key: '230919103714016-二级',
                name: '二级',
                type: 'node',
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919103714019': '小型企业',
                    color: '小型企业',
                    group: '230919103714019',
                    key: '230919103714019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '公司',
                    color: '公司',
                    group: '230919103714019',
                    key: '230919103714019-公司',
                    name: '公司',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '消费者',
                    color: '消费者',
                    group: '230919103714019',
                    key: '230919103714019-消费者',
                    name: '消费者',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  }
                ]
              },
              {
                '230919103714016': '一级',
                color: '一级',
                group: '230919103714016',
                key: '230919103714016-一级',
                name: '一级',
                type: 'node',
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919103714019': '小型企业',
                    color: '小型企业',
                    group: '230919103714019',
                    key: '230919103714019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '消费者',
                    color: '消费者',
                    group: '230919103714019',
                    key: '230919103714019-消费者',
                    name: '消费者',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '公司',
                    color: '公司',
                    group: '230919103714019',
                    key: '230919103714019-公司',
                    name: '公司',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  }
                ]
              },
              {
                '230919103714016': '标准级',
                color: '标准级',
                group: '230919103714016',
                key: '230919103714016-标准级',
                name: '标准级',
                type: 'node',
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919103714019': '消费者',
                    color: '消费者',
                    group: '230919103714019',
                    key: '230919103714019-消费者',
                    name: '消费者',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '小型企业',
                    color: '小型企业',
                    group: '230919103714019',
                    key: '230919103714019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  },
                  {
                    '230919103714019': '公司',
                    color: '公司',
                    group: '230919103714019',
                    key: '230919103714019-公司',
                    name: '公司',
                    type: 'node',
                    outDegree: 4,
                    inDegree: 4,
                    children: [
                      {
                        '230919103714022': '二级',
                        color: '二级',
                        group: '230919103714022',
                        key: '230919103714022-二级',
                        name: '二级',
                        type: 'node',
                        value: 3498777.6997537613,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '标准级',
                        color: '标准级',
                        group: '230919103714022',
                        key: '230919103714022-标准级',
                        name: '标准级',
                        type: 'node',
                        value: 9339292.830370903,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '当日',
                        color: '当日',
                        group: '230919103714022',
                        key: '230919103714022-当日',
                        name: '当日',
                        type: 'node',
                        value: 827490.930524826,
                        outDegree: 0,
                        inDegree: 3
                      },
                      {
                        '230919103714022': '一级',
                        color: '一级',
                        group: '230919103714022',
                        key: '230919103714022-一级',
                        name: '一级',
                        type: 'node',
                        value: 2403392.6722841263,
                        outDegree: 0,
                        inDegree: 3
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    tooltip: {
      handler: {}
    },
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    link: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: '71fea1bfaf872918422ee9e61d79eb03'
  };

  const spec1_update = {
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    minNodeHeight: 1,
    categoryField: 'key',
    nodeKey: d => d['key'],
    valueField: 'value',
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230919171022011': '技术',
                color: '技术',
                group: '230919171022011',
                key: '230919171022011-技术',
                name: '技术',
                type: 'node',
                value: 5469023.505149841,
                '230919103714013': 5469023.505149841,
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919202156019': '公司',
                    color: '公司',
                    group: '230919202156019',
                    key: '230919202156019-公司',
                    name: '公司',
                    type: 'node',
                    value: 1764574.614578247,
                    '230919103714013': 5152793.296570778,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '公司',
                        color: '公司',
                        group: '230919205000017',
                        key: '230919205000017-公司',
                        name: '公司',
                        type: 'node',
                        value: 1764574.614578247,
                        '230919103714013': 5152793.296570778,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  },
                  {
                    '230919202156019': '消费者',
                    color: '消费者',
                    group: '230919202156019',
                    key: '230919202156019-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2692828.4352111816,
                    '230919103714013': 8025072.194172859,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '消费者',
                        color: '消费者',
                        group: '230919205000017',
                        key: '230919205000017-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 2692828.4352111816,
                        '230919103714013': 8025072.194172859,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  },
                  {
                    '230919202156019': '小型企业',
                    color: '小型企业',
                    group: '230919202156019',
                    key: '230919202156019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 1011620.4553604126,
                    '230919103714013': 2891088.6421899796,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '小型企业',
                        color: '小型企业',
                        group: '230919205000017',
                        key: '230919205000017-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 1011620.4553604126,
                        '230919103714013': 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230919171022011': '办公用品',
                color: '办公用品',
                group: '230919171022011',
                key: '230919171022011-办公用品',
                name: '办公用品',
                type: 'node',
                value: 4865589.799788475,
                '230919103714013': 4865589.799788475,
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919202156019': '消费者',
                    color: '消费者',
                    group: '230919202156019',
                    key: '230919202156019-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2543529.3300714493,
                    '230919103714013': 8025072.194172859,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '消费者',
                        color: '消费者',
                        group: '230919205000017',
                        key: '230919205000017-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 2543529.3300714493,
                        '230919103714013': 8025072.194172859,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  },
                  {
                    '230919202156019': '公司',
                    color: '公司',
                    group: '230919202156019',
                    key: '230919202156019-公司',
                    name: '公司',
                    type: 'node',
                    value: 1484595.9238786697,
                    '230919103714013': 5152793.296570778,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '公司',
                        color: '公司',
                        group: '230919205000017',
                        key: '230919205000017-公司',
                        name: '公司',
                        type: 'node',
                        value: 1484595.9238786697,
                        '230919103714013': 5152793.296570778,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  },
                  {
                    '230919202156019': '小型企业',
                    color: '小型企业',
                    group: '230919202156019',
                    key: '230919202156019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 837464.545838356,
                    '230919103714013': 2891088.6421899796,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '小型企业',
                        color: '小型企业',
                        group: '230919205000017',
                        key: '230919205000017-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 837464.545838356,
                        '230919103714013': 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230919171022011': 'https://bing.com',
                color: 'https://bing.com',
                group: '230919171022011',
                key: '230919171022011-https://bing.com',
                name: 'https://bing.com',
                type: 'node',
                value: 5734340.8279953,
                '230919103714013': 5734340.8279953,
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919202156019': '消费者',
                    color: '消费者',
                    group: '230919202156019',
                    key: '230919202156019-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2788714.4288902283,
                    '230919103714013': 8025072.194172859,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '消费者',
                        color: '消费者',
                        group: '230919205000017',
                        key: '230919205000017-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 2788714.4288902283,
                        '230919103714013': 8025072.194172859,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  },
                  {
                    '230919202156019': '公司',
                    color: '公司',
                    group: '230919202156019',
                    key: '230919202156019-公司',
                    name: '公司',
                    type: 'node',
                    value: 1903622.758113861,
                    '230919103714013': 5152793.296570778,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '公司',
                        color: '公司',
                        group: '230919205000017',
                        key: '230919205000017-公司',
                        name: '公司',
                        type: 'node',
                        value: 1903622.758113861,
                        '230919103714013': 5152793.296570778,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  },
                  {
                    '230919202156019': '小型企业',
                    color: '小型企业',
                    group: '230919202156019',
                    key: '230919202156019-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 1042003.6409912109,
                    '230919103714013': 2891088.6421899796,
                    outDegree: 3,
                    inDegree: 3,
                    children: [
                      {
                        '230919205000017': '小型企业',
                        color: '小型企业',
                        group: '230919205000017',
                        key: '230919205000017-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 1042003.6409912109,
                        '230919103714013': 2891088.6421899796,
                        outDegree: 0,
                        inDegree: 3,
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: false,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 16,
        zIndex: 100,
        fill: '#f7555d',
        stroke: null,
        strokeOpacity: 1
      },
      limit: 200,
      interactive: false
    },
    tooltip: {
      handler: {}
    },
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    link: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: 'a0caad94135ce1882e7615e8119d4e92'
  };

  const spec2_update = {
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    minNodeHeight: 1,
    categoryField: 'key',
    valueField: 'value',
    nodeKey: d => d['key'],
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230919171022011': '技术',
                color: '技术',
                group: '230919171022011',
                key: '230919171022011-技术',
                name: '技术',
                type: 'node',
                value: 5469023.505149841,
                '230919103714013': 5469023.505149841,
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919205000017': '公司',
                    color: '公司',
                    group: '230919205000017',
                    key: '230919205000017-公司',
                    name: '公司',
                    type: 'node',
                    value: 1764574.614578247,
                    '230919103714013': 5152793.296570778,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  },
                  {
                    '230919205000017': '消费者',
                    color: '消费者',
                    group: '230919205000017',
                    key: '230919205000017-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2692828.4352111816,
                    '230919103714013': 8025072.194172859,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  },
                  {
                    '230919205000017': '小型企业',
                    color: '小型企业',
                    group: '230919205000017',
                    key: '230919205000017-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 1011620.4553604126,
                    '230919103714013': 2891088.6421899796,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  }
                ]
              },
              {
                '230919171022011': '办公用品',
                color: '办公用品',
                group: '230919171022011',
                key: '230919171022011-办公用品',
                name: '办公用品',
                type: 'node',
                value: 4865589.799788475,
                '230919103714013': 4865589.799788475,
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919205000017': '消费者',
                    color: '消费者',
                    group: '230919205000017',
                    key: '230919205000017-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2543529.3300714493,
                    '230919103714013': 8025072.194172859,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  },
                  {
                    '230919205000017': '公司',
                    color: '公司',
                    group: '230919205000017',
                    key: '230919205000017-公司',
                    name: '公司',
                    type: 'node',
                    value: 1484595.9238786697,
                    '230919103714013': 5152793.296570778,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  },
                  {
                    '230919205000017': '小型企业',
                    color: '小型企业',
                    group: '230919205000017',
                    key: '230919205000017-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 837464.545838356,
                    '230919103714013': 2891088.6421899796,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  }
                ]
              },
              {
                '230919171022011': 'https://bing.com',
                color: 'https://bing.com',
                group: '230919171022011',
                key: '230919171022011-https://bing.com',
                name: 'https://bing.com',
                type: 'node',
                value: 5734340.8279953,
                '230919103714013': 5734340.8279953,
                outDegree: 3,
                inDegree: 0,
                children: [
                  {
                    '230919205000017': '消费者',
                    color: '消费者',
                    group: '230919205000017',
                    key: '230919205000017-消费者',
                    name: '消费者',
                    type: 'node',
                    value: 2788714.4288902283,
                    '230919103714013': 8025072.194172859,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  },
                  {
                    '230919205000017': '公司',
                    color: '公司',
                    group: '230919205000017',
                    key: '230919205000017-公司',
                    name: '公司',
                    type: 'node',
                    value: 1903622.758113861,
                    '230919103714013': 5152793.296570778,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  },
                  {
                    '230919205000017': '小型企业',
                    color: '小型企业',
                    group: '230919205000017',
                    key: '230919205000017-小型企业',
                    name: '小型企业',
                    type: 'node',
                    value: 1042003.6409912109,
                    '230919103714013': 2891088.6421899796,
                    outDegree: 0,
                    inDegree: 3,
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: true,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 16,
        zIndex: 100,
        fill: '#f7555d',
        stroke: null,
        strokeOpacity: 1
      },
      limit: 200,
      interactive: false
    },
    tooltip: {
      handler: {}
    },
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    link: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: 'ed02f01497bb549cf3622a941932c75b'
  };

  const spec3_update = {
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    categoryField: 'key',
    valueField: 'value',
    link: {
      style: {
        pathType: 'smooth'
      },
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230920170354037': '中南',
                color: '中南',
                group: '230920170354037',
                key: '230920170354037-中南',
                name: '中南',
                type: 'node',
                value: 4137415.0951108932,
                '230920170354034': 4137415.0951108932,
                outDegree: 4,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 2309088.987888336,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 901351.8420200348,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 647170.607293129,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 279803.6579093933,
                    '230920170354034': 543999.8639507294,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  }
                ]
              },
              {
                '230920170354037': '西南',
                color: '西南',
                group: '230920170354037',
                key: '230920170354037-西南',
                name: '西南',
                type: 'node',
                value: 1303124.5089645386,
                '230920170354034': 1303124.5089645386,
                outDegree: 4,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 766227.8120193481,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 292123.4119319916,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 214409.8048610687,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 30363.4801521301,
                    '230920170354034': 543999.8639507294,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  }
                ]
              },
              {
                '230920170354037': '西北',
                color: '西北',
                group: '230920170354037',
                key: '230920170354037-西北',
                name: '西北',
                type: 'node',
                value: 815039.5979347229,
                '230920170354034': 815039.5979347229,
                outDegree: 4,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 62348.0195865631,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 462025.3692798615,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 259640.2487258911,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 31025.9603424072,
                    '230920170354034': 543999.8639507294,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  }
                ]
              },
              {
                '230920170354037': '地区-dongbei',
                color: '地区-dongbei',
                group: '230920170354037',
                key: '230920170354037-地区-dongbei',
                name: '地区-dongbei',
                type: 'node',
                value: 2681567.4745378494,
                '230920170354034': 2681567.4745378494,
                outDegree: 4,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 1647264.992395401,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 598626.2052869797,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 81002.901506424,
                    '230920170354034': 543999.8639507294,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 354673.3753490448,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  }
                ]
              },
              {
                '230920170354037': '华东',
                color: '华东',
                group: '230920170354037',
                key: '230920170354037-华东',
                name: '华东',
                type: 'node',
                value: 0,
                '230920170354034': 0,
                outDegree: 4,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 0,
                    '230920170354034': 543999.8639507294,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  }
                ]
              },
              {
                '230920170354037': '华北',
                color: '华北',
                group: '230920170354037',
                key: '230920170354037-华北',
                name: '华北',
                type: 'node',
                value: 2447301.0141382217,
                '230920170354034': 2447301.0141382217,
                outDegree: 4,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 1464256.2496786118,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 542254.3649234772,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 318986.5354957581,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 121803.8640403748,
                    '230920170354034': 543999.8639507294,
                    outDegree: 0,
                    inDegree: 6,
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: true,
      overlap: {
        hideOnHit: true,
        overlapPadding: 10,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 12,
        zIndex: 100,
        fill: '#363839',
        stroke: 'rgba(255, 255, 255, 0.8)',
        strokeOpacity: 1,
        lineWidth: 2
      },
      limit: 200,
      interactive: false
    },
    region: [
      {
        clip: false
      }
    ],
    extensionMark: [
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '中南',
          fontSize: 12,
          fill: 'red',
          y: 0
        }
      },
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '当日',
          fontSize: 12,
          fill: 'red',
          y: 0
        }
      }
    ],
    tooltip: {
      handler: {}
    },
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: 'd620b58401d072113f285aa7037c567a'
  };

  const spec4_update = {
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 0,
      left: 2,
      bottom: 0,
      right: 2
    },
    categoryField: 'key',
    valueField: 'value',
    link: {
      style: {
        pathType: 'smooth'
      },
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230920170354037': '华北',
                color: '华北',
                group: '230920170354037',
                key: '230920170354037-华北',
                name: '华北',
                type: 'node',
                value: 2447301.0141382217,
                '230920170354034': 2447301.0141382217,
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 161239.86883926392,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 161239.86883926392,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 20837.627975463867,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 20837.627975463867,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 237232.88373947144,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 237232.88373947144,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 61445.215839385986,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 61445.215839385986,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 163016.81268692017,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 163016.81268692017,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 315627.76114845276,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 315627.76114845276,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 544905.6529664993,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 544905.6529664993,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 39521.0202255249,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 39521.0202255249,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 57325.982006073,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 57325.982006073,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 63609.79108810425,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 63609.79108810425,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 682117.712972641,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 682117.712972641,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 100420.68465042114,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 100420.68465042114,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230920170354037': '西北',
                color: '西北',
                group: '230920170354037',
                key: '230920170354037-西北',
                name: '西北',
                type: 'node',
                value: 815039.5979347229,
                '230920170354034': 815039.5979347229,
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 62002.78022766113,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 62002.78022766113,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 61836.431911468506,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 61836.431911468506,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 7096.600036621094,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 7096.600036621094,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 18803.26025390625,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 18803.26025390625,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 237356.98112678528,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 237356.98112678528,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 43739.58361244202,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 43739.58361244202,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 5126.100051879883,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 5126.100051879883,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 162831.95624160767,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 162831.95624160767,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 169864.94074249268,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 169864.94074249268,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 27772.527755737305,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 27772.527755737305,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 9820.187911987305,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 9820.187911987305,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 8788.248062133789,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 8788.248062133789,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230920170354037': '西南',
                color: '西南',
                group: '230920170354037',
                key: '230920170354037-西南',
                name: '西南',
                type: 'node',
                value: 1303124.5089645386,
                '230920170354034': 1303124.5089645386,
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 48292.076080322266,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 48292.076080322266,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 137932.25577926636,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 137932.25577926636,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 27165.04006576538,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 27165.04006576538,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 110508.30136489868,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 110508.30136489868,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 2496.0599975585938,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2496.0599975585938,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 14919.716171264648,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 14919.716171264648,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 479747.631729126,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 479747.631729126,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 76736.46343040466,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 76736.46343040466,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 12947.703983306885,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 12947.703983306885,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 78526.75593566895,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 78526.75593566895,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 105899.08007240295,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 105899.08007240295,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 207953.42435455322,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 207953.42435455322,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230920170354037': '地区-dongbei',
                color: '地区-dongbei',
                group: '230920170354037',
                key: '230920170354037-地区-dongbei',
                name: '地区-dongbei',
                type: 'node',
                value: 2681567.4745378494,
                '230920170354034': 2681567.4745378494,
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 785608.566778183,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 785608.566778183,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 85133.94373703003,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 85133.94373703003,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 4617.591995239258,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 4617.591995239258,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 298002.60119628906,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 298002.60119628906,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 198293.94263839722,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 198293.94263839722,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 339639.0273742676,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 339639.0273742676,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 34304.80926513672,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 34304.80926513672,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 71245.48897361755,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 71245.48897361755,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 93348.47202587128,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 93348.47202587128,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 42080.50024604797,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 42080.50024604797,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 207275.13206481934,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 207275.13206481934,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 522017.39824295044,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 522017.39824295044,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230920170354037': '中南',
                color: '中南',
                group: '230920170354037',
                key: '230920170354037-中南',
                name: '中南',
                type: 'node',
                value: 4137415.0951108932,
                '230920170354034': 4137415.0951108932,
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 433963.2788925171,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 433963.2788925171,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 717389.1995487213,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 717389.1995487213,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 96088.13107299805,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 96088.13107299805,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 29316.52554321289,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 29316.52554321289,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 433355.5802783966,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 433355.5802783966,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 344421.0977716446,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 344421.0977716446,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 283551.1897010803,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 283551.1897010803,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 1157736.5094470978,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 1157736.5094470978,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 206661.37844848633,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 206661.37844848633,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 128063.55743408203,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 128063.55743408203,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 184445.07204055786,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 184445.07204055786,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 122423.57493209839,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 122423.57493209839,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230920170354037': '华东',
                color: '华东',
                group: '230920170354037',
                key: '230920170354037-华东',
                name: '华东',
                type: 'node',
                value: 0,
                '230920170354034': 0,
                outDegree: 12,
                inDegree: 0,
                children: [
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 0,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 0,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 0,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 0,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 0,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 0,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '当日',
                    color: '当日',
                    group: '230920170354057',
                    key: '230920170354057-当日',
                    name: '当日',
                    type: 'node',
                    value: 0,
                    '230920170354034': 543999.8639507294,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 0,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 0,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 0,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 0,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 0,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '二级',
                    color: '二级',
                    group: '230920170354057',
                    key: '230920170354057-二级',
                    name: '二级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 2593996.0728883743,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '公司',
                        color: '公司',
                        group: '230920170354076',
                        key: '230920170354076-公司',
                        name: '公司',
                        type: 'node',
                        value: 0,
                        '230920170354034': 3698077.491681099,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '一级',
                    color: '一级',
                    group: '230920170354057',
                    key: '230920170354057-一级',
                    name: '一级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 1597588.3425855637,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '小型企业',
                        color: '小型企业',
                        group: '230920170354076',
                        key: '230920170354076-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 0,
                        '230920170354034': 1948656.2699956894,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  },
                  {
                    '230920170354057': '标准级',
                    color: '标准级',
                    group: '230920170354057',
                    key: '230920170354057-标准级',
                    name: '标准级',
                    type: 'node',
                    value: 0,
                    '230920170354034': 6648863.4112615585,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230920170354076': '消费者',
                        color: '消费者',
                        group: '230920170354076',
                        key: '230920170354076-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 0,
                        '230920170354034': 5737713.929009438,
                        outDegree: 0,
                        inDegree: 24,
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        visible: true,
        maxRow: 2,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 16,
          bottom: 0,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: false,
      overlap: {
        hideOnHit: true,
        overlapPadding: 10,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 12,
        zIndex: 100,
        fill: '#363839',
        stroke: 'rgba(255, 255, 255, 0.8)',
        strokeOpacity: 1,
        lineWidth: 2
      },
      limit: 200,
      interactive: false
    },
    region: [
      {
        clip: false
      }
    ],
    extensionMark: [
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '华北',
          fontSize: 12,
          fill: 'red',
          y: 0
        }
      },
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '一级',
          fontSize: 12,
          fill: 'red',
          y: 0
        }
      },
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '小型企业',
          fontSize: 12,
          fill: 'red',
          y: 0
        }
      }
    ],
    tooltip: {
      handler: {}
    },
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: 'bac9588b1df4b39ecd241109d133d496'
  };

  const spec_extensionMark = {
    type: 'sankey',
    nodeGap: 5,
    nodeWidth: 12,
    nodeAlign: 'justify',
    iterations: 0,
    padding: {
      top: 20,
      left: 2,
      bottom: 0,
      right: 2
    },
    categoryField: 'key',
    valueField: 'value',
    nodeKey: datum => datum.key,
    link: {
      style: {
        pathType: 'smooth'
      },
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 0,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.025
        }
      }
    },
    color: {
      field: 'color',
      type: 'ordinal',
      range: [
        '#2E62F1',
        '#4DC36A',
        '#FF8406',
        '#FFCC00',
        '#4F44CF',
        '#5AC8FA',
        '#003A8C',
        '#B08AE2',
        '#FF6341',
        '#98DD62',
        '#07A199',
        '#87DBDD'
      ],
      specified: {
        '230927150532734-中南': '#f7555d',
        '230927150532734-西南': '#4DC36A',
        '230927150532734-华北': '#FF8406',
        '230927150532734-西北': '#FFCC00',
        '230927150532734-地区-dongbei': '#4F44CF',
        '230927150532734-华东': '#5AC8FA',
        '230927150532612-技术': '#003A8C',
        '230927150532612-https://bing.com': '#B08AE2',
        '230927150532612-办公用品': '#FF6341',
        '230927150532503-小型企业': '#98DD62',
        '230927150532503-公司': '#07A199',
        '230927150532503-消费者': '#87DBDD'
      },
      domain: [
        '230927150532734-中南',
        '230927150532612-技术',
        '230927150532503-小型企业',
        '230927150532612-https://bing.com',
        '230927150532503-公司',
        '230927150532612-办公用品',
        '230927150532503-消费者',
        '230927150532734-西南',
        '230927150532734-华北',
        '230927150532734-西北',
        '230927150532734-地区-dongbei',
        '230927150532734-华东'
      ]
    },
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                '230927150532734': '中南',
                color: '中南',
                group: '230927150532734',
                key: '230927150532734-中南',
                name: '中南',
                type: 'node',
                value: 670885.3138181865,
                '230927150532500': 670885.3138181865,
                outDegree: 9,
                inDegree: 0,
                children: [
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 53431.3920345306,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 53431.3920345306,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 56840.4546737671,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 56840.4546737671,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 70554.7358343005,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 70554.7358343005,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 64503.3204229921,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 64503.3204229921,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 62804.0283369645,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 62804.0283369645,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 78238.4259760305,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 78238.4259760305,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 127501.5002806187,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 127501.5002806187,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 36962.659976542,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 36962.659976542,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 120048.7962824404,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 120048.7962824404,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230927150532734': '西南',
                color: '西南',
                group: '230927150532734',
                key: '230927150532734-西南',
                name: '西南',
                type: 'node',
                value: 97636.7280354202,
                '230927150532500': 97636.7280354202,
                outDegree: 9,
                inDegree: 0,
                children: [
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 14171.7799986452,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 14171.7799986452,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 7116.031955719,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 7116.031955719,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 23205.5319166183,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 23205.5319166183,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 23859.1084332317,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 23859.1084332317,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 11241.327906251,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 11241.327906251,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: -3941.4762043953,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: -3941.4762043953,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 19977.7200603485,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 19977.7200603485,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: -202.6359863281,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: -202.6359863281,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 2209.3399553299,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2209.3399553299,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230927150532734': '华北',
                color: '华北',
                group: '230927150532734',
                key: '230927150532734-华北',
                name: '华北',
                type: 'node',
                value: 431053.2174924314,
                '230927150532500': 431053.2174924314,
                outDegree: 9,
                inDegree: 0,
                children: [
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 19027.2600879669,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 19027.2600879669,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 25328.1069660187,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 25328.1069660187,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 61813.0238857269,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 61813.0238857269,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 28237.8598418236,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 28237.8598418236,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 55628.3558434844,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 55628.3558434844,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 72239.8256998062,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 72239.8256998062,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 53399.640114218,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 53399.640114218,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 64146.5999884605,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 64146.5999884605,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 51232.5450649261,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 51232.5450649261,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230927150532734': '西北',
                color: '西北',
                group: '230927150532734',
                key: '230927150532734-西北',
                name: '西北',
                type: 'node',
                value: 98553.4755181521,
                '230927150532500': 98553.4755181521,
                outDegree: 9,
                inDegree: 0,
                children: [
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: -4328.3798751831,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: -4328.3798751831,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 15826.1040496826,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 15826.1040496826,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 2584.1199522018,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 2584.1199522018,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 5605.9918961525,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 5605.9918961525,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 19076.2039754391,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 19076.2039754391,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 20043.9116771147,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 20043.9116771147,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 23373.2799100205,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 23373.2799100205,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 7183.9878883362,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 7183.9878883362,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 9188.2560443878,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 9188.2560443878,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230927150532734': '地区-dongbei',
                color: '地区-dongbei',
                group: '230927150532734',
                key: '230927150532734-地区-dongbei',
                name: '地区-dongbei',
                type: 'node',
                value: 242191.509221375,
                '230927150532500': 242191.509221375,
                outDegree: 9,
                inDegree: 0,
                children: [
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 33218.2829744369,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 33218.2829744369,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 21599.5361284837,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 21599.5361284837,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 27189.4063851163,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 27189.4063851163,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 45042.9840445518,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 45042.9840445518,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 30198.8681536615,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 30198.8681536615,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 12284.951336354,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 12284.951336354,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 8189.3839025497,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 8189.3839025497,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 42763.0003143549,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 42763.0003143549,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 21705.0959818661,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 21705.0959818661,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  }
                ]
              },
              {
                '230927150532734': '华东',
                color: '华东',
                group: '230927150532734',
                key: '230927150532734-华东',
                name: '华东',
                type: 'node',
                value: 607218.6830426604,
                '230927150532500': 607218.6830426604,
                outDegree: 9,
                inDegree: 0,
                children: [
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 31069.8080854416,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 31069.8080854416,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 58642.3869447708,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 58642.3869447708,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 35506.7720455825,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 35506.7720455825,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 120711.1643723547,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 120711.1643723547,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': 'https://bing.com',
                    color: 'https://bing.com',
                    group: '230927150532612',
                    key: '230927150532612-https://bing.com',
                    name: 'https://bing.com',
                    type: 'node',
                    value: 73741.2349637002,
                    '230927150532500': 638735.6293110773,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 73741.2349637002,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 55779.415910691,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 55779.415910691,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '技术',
                    color: '技术',
                    group: '230927150532612',
                    key: '230927150532612-技术',
                    name: '技术',
                    type: 'node',
                    value: 71961.6239185035,
                    '230927150532500': 751162.94417274,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '公司',
                        color: '公司',
                        group: '230927150532503',
                        key: '230927150532503-公司',
                        name: '公司',
                        type: 'node',
                        value: 71961.6239185035,
                        '230927150532500': 681967.6347733513,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 43197.6719287932,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '小型企业',
                        color: '小型企业',
                        group: '230927150532503',
                        key: '230927150532503-小型企业',
                        name: '小型企业',
                        type: 'node',
                        value: 43197.6719287932,
                        '230927150532500': 412478.6609529555,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  },
                  {
                    '230927150532612': '办公用品',
                    color: '办公用品',
                    group: '230927150532612',
                    key: '230927150532612-办公用品',
                    name: '办公用品',
                    type: 'node',
                    value: 116608.6048728228,
                    '230927150532500': 757640.3536444083,
                    outDegree: 18,
                    inDegree: 18,
                    children: [
                      {
                        '230927150532503': '消费者',
                        color: '消费者',
                        group: '230927150532503',
                        key: '230927150532503-消费者',
                        name: '消费者',
                        type: 'node',
                        value: 116608.6048728228,
                        '230927150532500': 1053092.6314019188,
                        outDegree: 0,
                        inDegree: 18,
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    legends: [
      {
        type: 'discrete',
        item: {
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 400,
          spaceRow: 0,
          spaceCol: 0,
          padding: {
            top: 1,
            bottom: 1,
            left: 1,
            right: 1
          },
          background: {
            visible: false,
            style: {
              fillOpacity: 0.001
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square'
            }
          }
        },
        id: 'legend-discrete',
        orient: 'top',
        position: 'start',
        layoutType: 'normal',
        visible: true,
        maxRow: 1,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 50,
        pager: {
          layout: 'horizontal',
          padding: 0,
          textStyle: {},
          space: 0,
          handler: {
            preShape: 'triangleLeft',
            nextShape: 'triangleRight',
            style: {},
            state: {
              disable: {}
            }
          }
        },
        padding: {
          top: 0,
          bottom: 16,
          left: 0,
          right: 0
        }
      }
    ],
    label: {
      visible: true,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'moveY',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          },
          {
            type: 'moveX',
            offset: [
              -20, -19, -18, -17, -16, -15, -14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4,
              5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
            ]
          }
        ]
      },
      style: {
        fontSize: 22,
        zIndex: 400,
        fill: null,
        strokeOpacity: 1,
        lineWidth: 0
      },
      limit: 200,
      interactive: false
    },
    region: [
      {
        clip: false
      }
    ],
    extensionMark: [
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '地区',
          fontSize: 12,
          fill: '#141414',
          y: -8,
          dx: -2
        }
      },
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '类别',
          fontSize: 12,
          fill: '#141414',
          y: -8,
          dx: -2
        }
      },
      {
        type: 'text',
        dataId: 'data',
        style: {
          text: '细分',
          fontSize: 12,
          fill: '#141414',
          y: -8,
          dx: -2
        }
      }
    ],
    tooltip: {
      handler: {}
    },
    background: 'rgba(255, 255, 255, 0)',
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    emphasis: {
      enable: true,
      effect: 'related'
    },
    node: {
      state: {
        hover: {
          cursor: 'pointer',
          fillOpacity: 0.8,
          stroke: '#58595B',
          lineWidth: 1,
          zIndex: 500
        },
        selected: {
          cursor: 'pointer',
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        },
        blur: {
          fillOpacity: 0.1
        }
      }
    },
    animation: false,
    hash: '6da81209cec89438789d6eb767c14e48'
  };

  const spec5 = {
    type: 'sankey',
    crossNodeAlign: 'parent',
    data: [
      {
        name: 'data',
        values: [
          {
            nodes: [
              {
                value: 100,
                name: 'A',
                children: [
                  // {
                  //   name: 'top',
                  //   value: 40,
                  //   children: [
                  //     { name: '00', value: 15 },
                  //     { name: '01', value: 10 },
                  //     { name: '02', value: 10 }
                  //   ]
                  // },
                  {
                    name: 'middle',
                    value: 30,
                    children: [
                      { name: '00', value: 10 },
                      { name: '01', value: 10 },
                      { name: '02', value: 10 }
                    ]
                  },
                  {
                    name: 'bottom',
                    value: 30
                  }
                ]
              },
              {
                value: 80,
                name: 'B',
                children: [
                  // {
                  //   name: 'top',
                  //   value: 40,
                  //   children: [
                  //     { name: '00', value: 100 },
                  //     { name: '01', value: 40 }
                  //   ]
                  // },
                  {
                    name: 'middle',
                    value: 10
                  },
                  {
                    name: 'bottom',
                    value: 30
                  }
                ]
              },
              {
                value: 50,
                name: 'C',
                children: [
                  {
                    name: 'top',
                    value: 20
                  },
                  {
                    name: 'middle',
                    value: 20
                  },
                  {
                    name: 'bottom',
                    value: 10
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    categoryField: 'name',
    valueField: 'value',
    nodeSortBy: (nodeA, nodeB) => {
      const nodeOrder = {
        A: 0,
        B: 1,
        C: 2,
        top: 3,
        middle: 4,
        bottom: 5,
        '00': 6,
        '01': 7,
        '02': 8
      };
      return nodeOrder[nodeA.key] - nodeOrder[nodeB.key];
    },

    nodeAlign: 'left',
    nodeGap: 8,
    nodeWidth: 10,
    minNodeHeight: 4,
    nodeKey: datum => datum.name,

    label: {
      visible: true,
      state: {
        blur: {
          fill: '#e8e8e8',
          fillOpacity: 0.15
        }
      }
    },

    node: {
      state: {
        hover: {
          fill: 'red'
        },
        blur: {
          fill: '#e8e8e8',
          fillOpacity: 0.15
        }
      }
    },

    link: {
      backgroundStyle: { fill: '#ccc', fillOpacity: 0.2 },
      fillOpacity: 0.8,
      state: {
        hover: {
          stroke: '#000000'
        },
        blur: {
          fill: '#e8e8e8'
        }
      }
    },

    emphasis: {
      enable: true,
      effect: 'related'
    }
  };

  const vChart = new VChart(spec_downstream, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    disableDirtyBounds: false
  });
  vChart.renderAsync();
  // vChart.renderAsync().then(() => {
  //   setTimeout(() => {
  //     console.log('updateSpec');
  //     vChart.updateSpec(spec4_update);
  //   }, 3000);
  // });
  window['vchart'] = vChart;

  // 监听点击事件
  // vChart.on('click', { level: 'mark' }, ctx => {
  //   console.log('mark', ctx);
  //   vChart.updateState({
  //     // 名称与上方配置要对应
  //     custom_unSelected: {
  //       filter: datum => {
  //         // 数据 type 不相等的进入这个状态
  //         console.log('datum', datum);
  //         return datum.source !== ctx.datum.key && datum.target !== ctx.datum.key;
  //       }
  //     }
  //   });
  // });

  // setTimeout(() => {
  //   console.log(111, data[2]);
  //   vChart.updateData('data', data[2]);
  // }, 2000);

  // vChart.on('click', ctx => {
  //   console.log('click-ctx', ctx);
  //   vChart.updateData('data', [
  //     {
  //       name: 'data',
  //       values: [
  //         {
  //           nodes: [
  //             {
  //               // value: 80,
  //               name: 'B',
  //               children: [
  //                 {
  //                   name: 'top',
  //                   // value: 40,
  //                   children: [
  //                     { name: '00', value: 100 },
  //                     { name: '01', value: 40 }
  //                   ]
  //                 },
  //                 {
  //                   name: 'middle',
  //                   value: 10
  //                 },
  //                 {
  //                   name: 'bottom',
  //                   value: 30
  //                 }
  //               ]
  //             },
  //             {
  //               value: 50,
  //               name: 'C',
  //               children: [
  //                 {
  //                   name: 'top',
  //                   value: 20
  //                 },
  //                 {
  //                   name: 'middle',
  //                   value: 20
  //                 },
  //                 {
  //                   name: 'bottom',
  //                   value: 10
  //                 }
  //               ]
  //             }
  //           ]
  //         }
  //       ]
  //     }
  //   ]);
  // });
};
run();
