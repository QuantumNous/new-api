import { isMobile } from 'react-device-detect';
import type { ILineChartSpec } from '../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { default as VChart } from '../../../../src/index';
import { scaleWholeRangeSize } from '@visactor/vscale';

const run = async () => {
  const size = {
    width: Math.floor(scaleWholeRangeSize(6, 40, 0.1, 0.25)),
    height: 100
  };
  console.log(size);
  const spec = {
    ...size,
    type: 'line',
    xField: ['230928171432050'],
    yField: ['10002'],
    direction: 'vertical',
    sortDataByAxis: true,
    seriesField: '20001',
    padding: 0,
    labelLayout: 'region',
    data: {
      id: 'data',
      values: [
        {
          '10001': '销售额',
          '10002': '96121.48056411743',
          '10003': '230928171432022',
          '20001': '销售额',
          '230928171432022': '96121.48056411743',
          '230928171432031': '公司',
          '230928171432050': '西南',
          '230928171432053': '办公用品'
        },
        {
          '10001': '数量',
          '10002': '581',
          '10003': '230928171432025',
          '20001': '数量',
          '230928171432025': '581',
          '230928171432031': '公司',
          '230928171432050': '西南',
          '230928171432053': '办公用品'
        },
        {
          '10001': '销售额',
          '10002': '416260.514667511',
          '10003': '230928171432022',
          '20001': '销售额',
          '230928171432022': '416260.514667511',
          '230928171432031': '公司',
          '230928171432050': '华东',
          '230928171432053': '办公用品'
        },
        {
          '10001': '数量',
          '10002': '1834',
          '10003': '230928171432025',
          '20001': '数量',
          '230928171432025': '1834',
          '230928171432031': '公司',
          '230928171432050': '华东',
          '230928171432053': '办公用品'
        },
        {
          '10001': '销售额',
          '10002': '254171.7369365692',
          '10003': '230928171432022',
          '20001': '销售额',
          '230928171432022': '254171.7369365692',
          '230928171432031': '公司',
          '230928171432050': '地区-dongbei',
          '230928171432053': '办公用品'
        },
        {
          '10001': '数量',
          '10002': '1148',
          '10003': '230928171432025',
          '20001': '数量',
          '230928171432025': '1148',
          '230928171432031': '公司',
          '230928171432050': '地区-dongbei',
          '230928171432053': '办公用品'
        },
        {
          '10001': '销售额',
          '10002': '413415.9689235687',
          '10003': '230928171432022',
          '20001': '销售额',
          '230928171432022': '413415.9689235687',
          '230928171432031': '公司',
          '230928171432050': '中南',
          '230928171432053': '办公用品'
        },
        {
          '10001': '数量',
          '10002': '1797',
          '10003': '230928171432025',
          '20001': '数量',
          '230928171432025': '1797',
          '230928171432031': '公司',
          '230928171432050': '中南',
          '230928171432053': '办公用品'
        },
        {
          '10001': '销售额',
          '10002': '85311.60458755493',
          '10003': '230928171432022',
          '20001': '销售额',
          '230928171432022': '85311.60458755493',
          '230928171432031': '公司',
          '230928171432050': '西北',
          '230928171432053': '办公用品'
        },
        {
          '10001': '数量',
          '10002': '313',
          '10003': '230928171432025',
          '20001': '数量',
          '230928171432025': '313',
          '230928171432031': '公司',
          '230928171432050': '西北',
          '230928171432053': '办公用品'
        },
        {
          '10001': '销售额',
          '10002': '219314.61819934845',
          '10003': '230928171432022',
          '20001': '销售额',
          '230928171432022': '219314.61819934845',
          '230928171432031': '公司',
          '230928171432050': '华北',
          '230928171432053': '办公用品'
        },
        {
          '10001': '数量',
          '10002': '841',
          '10003': '230928171432025',
          '20001': '数量',
          '230928171432025': '841',
          '230928171432031': '公司',
          '230928171432050': '华北',
          '230928171432053': '办公用品'
        }
      ],
      fields: {
        '10001': {
          alias: '指标名称 '
        },
        '10002': {
          alias: '指标值 '
        },
        '20001': {
          alias: '图例项 ',
          domain: ['销售额', '数量'],
          sortIndex: 0,
          lockStatisticsByDomain: true
        },
        '230928171432022': {
          alias: '销售额'
        },
        '230928171432025': {
          alias: '数量'
        },
        '230928171432031': {
          alias: '细分'
        },
        '230928171432050': {
          alias: '地区'
        },
        '230928171432053': {
          alias: '类别'
        }
      }
    },
    stackInverse: true,
    axes: [
      {
        range: {
          min: 0,
          max: 550000
        },
        type: 'linear',
        tick: {
          visible: false,
          style: {
            stroke: 'rgba(255, 255, 255, 0)'
          }
        },
        niceType: 'accurateFirst',
        zIndex: 200,
        grid: {
          visible: true,
          style: {
            zIndex: 150,
            stroke: '#DADCDD',
            lineWidth: 1,
            lineDash: [4, 2]
          }
        },
        orient: 'left',
        visible: true,
        domainLine: {
          visible: false,
          style: {
            lineWidth: 1,
            stroke: 'rgba(255, 255, 255, 0)'
          }
        },
        title: {
          visible: false,
          text: '销售额',
          space: 8,
          style: {
            fontSize: 12,
            fill: '#363839',
            fontWeight: 'normal'
          }
        },
        sampling: false,
        label: {
          visible: false,
          space: 6,
          flush: true,
          padding: 0,
          style: {
            fontSize: 20,
            maxLineWidth: 174,
            fill: '#6F6F6F',
            angle: 0,
            fontWeight: 'normal',
            dy: -1,
            direction: 'horizontal'
          },
          autoHide: true,
          autoHideMethod: 'greedy'
        },
        hover: false,
        background: {
          visible: true,
          state: {
            hover: {
              fillOpacity: 0.08,
              fill: '#141414'
            },
            hover_reverse: {
              fillOpacity: 0.08,
              fill: '#141414'
            }
          }
        },
        zero: true,
        nice: true,
        seriesIndex: 0,
        sync: {
          axisId: 'NO_AXISID_FRO_VTABLE'
        }
      },
      {
        domain: ['西南', '华东', '地区-dongbei', '中南', '西北', '华北'],
        type: 'band',
        tick: {
          visible: false
        },
        grid: {
          visible: false,
          style: {
            zIndex: 150,
            stroke: '#DADCDD',
            lineWidth: 1,
            lineDash: [4, 2]
          }
        },
        orient: 'bottom',
        visible: true,
        domainLine: {
          visible: false,
          style: {
            lineWidth: 1,
            stroke: '#989999'
          }
        },
        title: {
          visible: false,
          space: 5,
          text: '地区',
          style: {
            fontSize: 12,
            fill: '#363839',
            fontWeight: 'normal'
          }
        },
        sampling: false,
        zIndex: 200,
        label: {
          visible: false,
          space: 4,
          style: {
            fontSize: 12,
            fill: '#6F6F6F',
            angle: 0,
            fontWeight: 'normal',
            direction: 'horizontal'
          },
          autoHide: true,
          autoHideMethod: 'greedy',
          flush: true
        },
        hover: false,
        background: {
          visible: true,
          state: {
            hover: {
              fillOpacity: 0.08,
              fill: '#141414'
            },
            hover_reverse: {
              fillOpacity: 0.08,
              fill: '#141414'
            }
          }
        },
        paddingInner: 0.1,
        paddingOuter: 0.25,
        autoRegionSize: true,
        bandSize: 40,
        subTick: {
          visible: false
        }
      }
    ],
    color: {
      field: '20001',
      type: 'ordinal',
      range: ['#2E62F1', '#4DC36A'],
      specified: {},
      domain: ['销售额', '数量']
    },
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
        ],
        clampForce: true
      },
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        zIndex: 400,
        fill: null,
        strokeOpacity: 1
      },
      position: 'center',
      smartInvert: {
        fillStrategy: 'invertBase',
        strokeStrategy: 'similarBase'
      }
    },
    tooltip: {
      handler: {}
    },
    point: {
      style: {
        shape: {
          type: 'ordinal',
          field: '20001',
          range: ['circle'],
          domain: ['销售额', '数量']
        },
        size: {
          type: 'ordinal',
          field: '20001',
          range: [7.0898154036220635],
          domain: ['销售额', '数量']
        },
        fill: {
          field: '20001',
          type: 'ordinal',
          range: ['#2E62F1', '#4DC36A'],
          specified: {},
          domain: ['销售额', '数量']
        },
        stroke: {
          field: '20001',
          type: 'ordinal',
          range: ['#2E62F1', '#4DC36A'],
          specified: {},
          domain: ['销售额', '数量']
        },
        strokeOpacity: {
          type: 'ordinal',
          field: '20001',
          range: [1],
          domain: ['销售额', '数量']
        },
        fillOpacity: {
          type: 'ordinal',
          field: '20001',
          range: [1],
          domain: ['销售额', '数量']
        }
      },
      state: {
        hover: {
          lineWidth: 2,
          fillOpacity: 1,
          strokeOpacity: 1,
          scaleX: 1.5,
          scaleY: 1.5
        }
      }
    },
    seriesMark: 'point',
    line: {
      style: {
        curveType: {
          type: 'ordinal',
          field: '20001',
          range: ['linear'],
          domain: ['销售额', '数量']
        },
        lineWidth: {
          type: 'ordinal',
          field: '20001',
          range: [3],
          domain: ['销售额', '数量']
        },
        lineDash: {
          type: 'ordinal',
          field: '20001',
          range: [[0, 0]],
          domain: ['销售额', '数量']
        }
      }
    },
    region: [
      {
        clip: true,
        style: {
          //fill: 'red'
        }
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    area: {
      style: {
        curveType: {
          type: 'ordinal',
          field: '20001',
          range: ['linear'],
          domain: ['销售额', '数量']
        }
      }
    },
    invalidType: 'break',
    scrollBar: [
      {
        orient: 'bottom',
        start: 0,
        auto: true,
        roam: true
      }
    ],
    animation: false,
    brush: {
      inBrush: {
        style: {
          fillOpacity: 1,
          stroke: '#58595B',
          lineWidth: 1
        }
      },
      outOfBrush: {
        style: {
          fillOpacity: 0.3,
          strokeWidth: 0.3
        }
      }
    },
    crosshair: {
      xField: {
        visible: true
      },
      gridZIndex: 100
    },
    dataZoom: []
  } as ILineChartSpec;

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    onError: e => {
      console.log(e);
    }
  });

  console.time('render');
  cs.renderSync();

  await cs.setCurrentTheme('dark');

  console.timeEnd('render');
  // setTimeout(() => {
  //   cs.release();
  // }, 50);
  // cs.updateFullDataSync([{ id: 'data1', values: [day] }]);
  (window as any).vchart = cs;
  console.log((window as any).encodeGraphic);
};
run();
