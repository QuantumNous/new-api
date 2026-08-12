import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = async () => {
  const dataSet = new DataSet();
  dataSet.registerParser('csv', csvParser);
  const dataView = new DataView(dataSet);
  const type1 = ['A', 'B'];
  const type2 = ['A', 'B'];
  const color = {
    A: {
      A: 'A',
      B: 'B'
    },
    B: {
      A: 'C',
      B: 'D'
    }
  };

  let data = 'y,x,y2,type,type2,color';
  type2.forEach(t2 => {
    type1.forEach(t => {
      for (let i = 0; i < 10; i++) {
        data += `\n${Math.floor(Math.random() * 300) + 600},${i},0,${t},${t2},${color[t][t2]}`;
      }
    });
  });

  dataView.parse(data, {
    type: 'csv'
  });
  const spec = {
    type: 'line',
    xField: ['250109111947088'],
    yField: ['10002'],
    direction: 'vertical',
    seriesField: '20001',
    padding: 0,
    labelLayout: 'region',
    data: [
      {
        id: 'data',
        values: [
          {
            '10001': 'sales',
            '10002': '572.88',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-01',
            '250109111947091': '572.88'
          },
          {
            '10001': 'sales',
            '10002': '3599.9880000000003',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-03',
            '250109111947091': '3599.9880000000003'
          },
          {
            '10001': 'sales',
            '10002': '15928.248',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-04',
            '250109111947091': '15928.248'
          },
          {
            '10001': 'sales',
            '10002': '3593.9680000000003',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-05',
            '250109111947091': '3593.9680000000003'
          },
          {
            '10001': 'sales',
            '10002': '9932.328000000001',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-06',
            '250109111947091': '9932.328000000001'
          },
          {
            '10001': 'sales',
            '10002': '186.396',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-08',
            '250109111947091': '186.396'
          },
          {
            '10001': 'sales',
            '10002': '541.8',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-09',
            '250109111947091': '541.8'
          },
          {
            '10001': 'sales',
            '10002': '7029.958',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-10',
            '250109111947091': '7029.958'
          },
          {
            '10001': 'sales',
            '10002': '56.448',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-11',
            '250109111947091': '56.448'
          },
          {
            '10001': 'sales',
            '10002': '3004.6800000000003',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-12',
            '250109111947091': '3004.6800000000003'
          },
          {
            '10001': 'sales',
            '10002': '4945.756',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-14',
            '250109111947091': '4945.756'
          },
          {
            '10001': 'sales',
            '10002': '12221',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-16',
            '250109111947091': '12221'
          },
          {
            '10001': 'sales',
            '10002': '9317.868',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-17',
            '250109111947091': '9317.868'
          },
          {
            '10001': 'sales',
            '10002': '7425.824',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-18',
            '250109111947091': '7425.824'
          },
          {
            '10001': 'sales',
            '10002': '2919.2799999999997',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-20',
            '250109111947091': '2919.2799999999997'
          },
          {
            '10001': 'sales',
            '10002': '600.908',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-21',
            '250109111947091': '600.908'
          },
          {
            '10001': 'sales',
            '10002': '25273.829999999998',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-23',
            '250109111947091': '25273.829999999998'
          },
          {
            '10001': 'sales',
            '10002': '6008.099999999999',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-24',
            '250109111947091': '6008.099999999999'
          },
          {
            '10001': 'sales',
            '10002': '2753.46',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-25',
            '250109111947091': '2753.46'
          },
          {
            '10001': 'sales',
            '10002': '24794.174',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-26',
            '250109111947091': '24794.174'
          },
          {
            '10001': 'sales',
            '10002': '17047.379999999997',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-27',
            '250109111947091': '17047.379999999997'
          },
          {
            '10001': 'sales',
            '10002': '711.48',
            '10003': '250109111947091',
            '20001': 'sales',
            '250109111947088': '2017-01-29',
            '250109111947091': '711.48'
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
            domain: ['sales'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '250109111947088': {
            alias: 'order_date',
            domain: [
              '2017-01-01',
              '2017-01-03',
              '2017-01-04',
              '2017-01-05',
              '2017-01-06',
              '2017-01-08',
              '2017-01-09',
              '2017-01-10',
              '2017-01-11',
              '2017-01-12',
              '2017-01-14',
              '2017-01-16',
              '2017-01-17',
              '2017-01-18',
              '2017-01-20',
              '2017-01-21',
              '2017-01-23',
              '2017-01-24',
              '2017-01-25',
              '2017-01-26',
              '2017-01-27',
              '2017-01-29'
            ],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '250109111947091': {
            alias: 'sales'
          }
        }
      }
    ],
    stackInverse: true,
    axes: [
      {
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
          visible: true,
          style: {
            lineWidth: 1,
            stroke: '#989999'
          }
        },
        title: {
          visible: false,
          space: 5,
          text: 'order_date',
          style: {
            fontSize: 12,
            fill: '#363839',
            fontWeight: 'normal'
          }
        },
        maxHeight: null,
        autoIndent: false,
        sampling: false,
        zIndex: 200,
        label: {
          visible: true,
          space: 4,
          style: {
            fontSize: 12,
            fill: '#6F6F6F',
            angle: 0,
            fontWeight: 'normal',
            direction: 'horizontal',
            maxLineWidth: 174
          },
          autoHide: true,
          autoHideMethod: 'greedy',
          flush: true,
          lastVisible: true
        },
        hover: true,
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
        paddingInner: 0.36249999999999993,
        paddingOuter: 0.175
      },
      {
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
          visible: true,
          style: {
            lineWidth: 1,
            stroke: 'rgba(255, 255, 255, 0)'
          }
        },
        title: {
          visible: false,
          text: 'sales',
          space: 8,
          style: {
            fontSize: 12,
            fill: '#363839',
            fontWeight: 'normal'
          }
        },
        autoIndent: false,
        sampling: false,
        label: {
          visible: true,
          space: 6,
          flush: true,
          padding: 0,
          style: {
            fontSize: 12,
            maxLineWidth: 174,
            fill: '#6F6F6F',
            angle: 0,
            fontWeight: 'normal',
            dy: 0,
            direction: 'horizontal'
          },
          autoHide: true,
          autoHideMethod: 'greedy'
        },
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
        innerOffset: {
          top: 4.4311346272637895
        },
        zero: true,
        nice: true
      }
    ],
    color: {
      field: '20001',
      type: 'ordinal',
      range: ['#2E62F1'],
      specified: {},
      domain: ['sales']
    },
    legends: [
      {
        type: 'discrete',
        visible: true,
        id: 'legend-discrete',
        orient: 'right',
        position: 'start',
        layoutType: 'normal',
        maxCol: 1,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 60,
        item: {
          focus: true,
          focusIconStyle: {
            size: 14
          },
          maxWidth: 398,
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
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'circle',
              fillOpacity: 1,
              size: 10
            }
          }
        },
        pager: {
          type: 'default',
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
        alignSelf: 'end',
        padding: {
          top: 0,
          bottom: 12,
          left: 16,
          right: 0
        }
      }
    ],
    label: {
      visible: false,
      offset: 3,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'position',
            position: ['top', 'bottom']
          }
        ],
        clampForce: true
      },
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        zIndex: 400,
        lineHeight: '100%',
        boundsPadding: [1, 0, 0, 0],
        fill: '#363839',
        stroke: 'rgba(255, 255, 255, 0.8)',
        lineWidth: 2,
        strokeOpacity: 1
      },
      position: 'top',
      smartInvert: false
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
          domain: ['sales']
        },
        size: {
          type: 'ordinal',
          field: '20001',
          range: [7.0898154036220635],
          domain: ['sales']
        },
        fill: {
          field: '20001',
          type: 'ordinal',
          range: ['#2E62F1'],
          specified: {},
          domain: ['sales']
        },
        stroke: {
          field: '20001',
          type: 'ordinal',
          range: ['#2E62F1'],
          specified: {},
          domain: ['sales']
        },
        strokeOpacity: {
          type: 'ordinal',
          field: '20001',
          range: [1],
          domain: ['sales']
        },
        fillOpacity: {
          type: 'ordinal',
          field: '20001',
          range: [1],
          domain: ['sales']
        }
      },
      state: {
        hover: {
          lineWidth: 2,
          fillOpacity: 1,
          strokeOpacity: 1,
          scaleX: 1.5,
          scaleY: 1.5,
          cursor: 'pointer'
        },
        dimension_hover: {
          visible: true
        }
      }
    },
    line: {
      style: {
        curveType: {
          type: 'ordinal',
          field: '20001',
          range: ['linear'],
          domain: ['sales']
        },
        lineWidth: {
          type: 'ordinal',
          field: '20001',
          range: [3],
          domain: ['sales']
        },
        lineDash: {
          type: 'ordinal',
          field: '20001',
          range: [[0, 0]],
          domain: ['sales']
        }
      }
    },
    seriesMark: 'line',
    markOverlap: true,
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    area: {
      style: {
        curveType: {
          type: 'ordinal',
          field: '20001',
          range: ['linear'],
          domain: ['sales']
        }
      }
    },
    invalidType: 'break',
    animation: false,
    brush: {
      // onBrushEnd: () => {
      //   console.log('onBrushEnd');
      //   return true;
      // },
      // markTypeFilter: ['line'],
      endTrigger: ['pointerup', 'pointerupoutside'],
      sizeThreshold: 50,
      inBrush: {
        fillOpacity: 1,
        strokeOpacity: 1,
        colorAlpha: 1
      },
      outOfBrush: {
        colorAlpha: 0.2,
        fillOpacity: 0.3
      }
    },
    crosshair: {
      xField: {
        visible: true,
        line: {
          type: 'rect',
          style: {
            fillOpacity: 0.2,
            fill: '#b2bacf'
          }
        }
      },
      gridZIndex: 100
    },
    hash: '3d3f5254de2551eaf32c946dd44bb42e'
  };

  const cs = new VChart(spec, {
    dataSet,
    dom: document.getElementById('chart'),
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
    cs.on('brushStart', (...e) => console.log('brushStart', e));
    cs.on('brushEnd', (...e) => console.log('brushEnd', e));
    cs.on('brushClear', (...e) => console.log('brushClear', e));
    cs.on('brushActive', (...e) => console.log('brushActive', e));
  });

  const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/brush-data.json');
  const dataBrush = await response.json();

  const row = 4;
  const col = 4;
  const region = [];
  const layoutElements = [];
  const series = [];
  const axes = [];
  const rowHeight = [];
  for (let k = 0; k < row * col; k++) {
    region.push({
      id: `${k}_Region`
    });

    const seriesRow = Math.floor(k / col) + Math.floor(k / col);
    const seriesCol = k - Math.floor(k / col) * col;

    // 系列行
    layoutElements.push({
      row: seriesRow,
      col: seriesCol + seriesCol + 1,
      modelId: `${k}_Region`
    });

    series.push({
      id: `${k}_Region`,
      type: 'scatter',
      xField: 'x',
      yField: 'y',
      seriesField: 'type',
      data: { id: `${k}_Data`, values: dataBrush[k] },
      regionId: `${k}_Region`,
      size: 5
    });

    axes.push({
      id: `${k}_Left`,
      orient: 'left',
      regionId: `${k}_Region`,
      seriesId: [`${k}_Region`],
      zero: false
    });

    layoutElements.push({
      row: seriesRow,
      col: seriesCol + seriesCol,
      modelId: `${k}_Left`
    });

    axes.push({
      id: `${k}_Bottom`,
      orient: 'bottom',
      regionId: `${k}_Region`,
      seriesId: [`${k}_Region`],
      type: 'linear',
      zero: false
    });

    layoutElements.push({
      row: seriesRow + 1,
      col: seriesCol + seriesCol + 1,
      modelId: `${k}_Bottom`
    });

    if (seriesCol === 0) {
      rowHeight.push({
        index: seriesRow + 1,
        size: 30
      });
    }
  }

  const spec2 = {
    type: 'common',
    padding: 30,
    region,
    layout: {
      type: 'grid',
      col: col * 2,
      row: row * 2,
      elements: layoutElements,
      rowHeight
    },
    axes,
    tooltip: false,
    series,
    brush: {
      seriesIndex: Array.from({ length: 16 }, (v, k) => k),
      brushType: 'rect',
      brushLinkSeriesIndex: Array.from({ length: 16 }, (v, k) => k),
      inBrush: {
        colorAlpha: 1
      },
      outOfBrush: {
        colorAlpha: 0.2
      }
    }
  };

  const cs2 = new VChart(spec2, {
    dataSet,
    dom: document.getElementById('chart'),
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs2.renderAsync().then(() => {
    console.timeEnd('renderTime');
    cs2.on('brushStart', (...e) => console.log('brushStart-2', e));
    cs2.on('brushEnd', (...e) => console.log('brushEnd-2', e));
    cs2.on('brushClear', (...e) => console.log('brushClear-2', e));
    cs2.on('brushActive', (...e) => console.log('brushActive-2', e));
  });
  window['vchart2'] = cs;
  console.log(cs);

  const spec3 = {
    type: 'scatter',
    data: [
      {
        values: [
          { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
          { x: 1270911, size: 219815, y: 5590, type: 'office supplies', area: 'Zhongnan' },
          { x: 453898, size: 19061, y: 727, type: 'Technology', area: 'Southwest' },
          { x: 919743, size: 148800, y: 1199, type: 'furniture', area: 'North China' },
          { x: 1676224, size: 163453, y: 2517, type: 'furniture', area: 'East China' },
          { x: 1466575, size: 251487, y: 2087, type: 'Technology', area: 'Zhongnan' },
          { x: 824673, size: 86067, y: 3622, type: 'office supplies', area: 'Northeast' },
          { x: 230956, size: 24016, y: 347, type: 'Technology', area: 'Northwest' },
          { x: 1599653, size: 228179, y: 2183, type: 'Technology', area: 'East China' },
          { x: 745813, size: 137265, y: 3020, type: 'office supplies', area: 'North China' },
          { x: 267870, size: 49633, y: 970, type: 'office supplies', area: 'Northwest' },
          { x: 1408628, size: 215585, y: 6341, type: 'office supplies', area: 'East China' },
          { x: 781743, size: 144986, y: 927, type: 'Technology', area: 'North China' },
          { x: 501533, size: 29303, y: 814, type: 'furniture', area: 'Southwest' },
          { x: 920698, size: 72692, y: 1470, type: 'furniture', area: 'Northeast' },
          { x: 316212, size: 24903, y: 468, type: 'furniture', area: 'Northwest' },
          { x: 1399928, size: 199582, y: 2023, type: 'furniture', area: 'Zhongnan' },
          { x: 347692, size: 49272, y: 1858, type: 'office supplies', area: 'Southwest' }
        ]
      }
    ],
    xField: 'x',
    yField: 'y',
    seriesField: 'type',
    sizeField: 'size',
    size: [10, 25],
    shapeField: 'type',
    shape: ['circle', 'triangle'],
    axes: [
      { orient: 'left', range: { min: 0 }, type: 'linear' },
      { orient: 'bottom', label: { visible: true }, type: 'linear' }
    ],
    legends: [
      {
        visible: true,
        orient: 'left',
        position: 'start',
        title: {
          visible: true,
          style: {
            text: 'title'
          }
        },
        item: {
          visible: true
        }
      }
    ],
    direction: 'horizontal',
    brush: {
      brushMode: 'multiple',
      brushType: 'rect',
      inBrush: {
        colorAlpha: 1
      },
      outOfBrush: {
        colorAlpha: 0.2
      }
    }
  };
  const cs3 = new VChart(spec3, {
    dataSet,
    dom: document.getElementById('chart'),
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs3.renderAsync().then(() => {
    console.timeEnd('renderTime');
    cs3.on('brushStart', (...e) => console.log('brushStart-3', e));
    cs3.on('brushEnd', (...e) => console.log('brushEnd-3', e));
    cs3.on('brushClear', (...e) => console.log('brushClear-3', e));
    cs3.on('brushActive', (...e) => console.log('brushActive-3', e));
  });
  window['vchart3'] = cs3;

  const spec4 = {
    type: 'bar',
    xField: ['10002'],
    yField: ['241216184524145', '20001'],
    direction: 'horizontal',
    seriesField: '20001',
    padding: 0,
    labelLayout: 'region',
    data: [
      {
        id: 'data',
        values: [
          {
            '10001': '销售额',
            '10002': '710386.2080000001',
            '10003': '241216184524139',
            '20001': '公司-销售额',
            '241216184524139': '710386.2080000001',
            '241216184524145': '2019',
            '241216184524148': '公司'
          },
          {
            '10001': '利润',
            '10002': '96740.72800000002',
            '10003': '241216184524142',
            '20001': '公司-利润',
            '241216184524142': '96740.72800000002',
            '241216184524145': '2019',
            '241216184524148': '公司'
          },
          {
            '10001': '销售额',
            '10002': '401978.82199999975',
            '10003': '241216184524139',
            '20001': '小型企业-销售额',
            '241216184524139': '401978.82199999975',
            '241216184524145': '2019',
            '241216184524148': '小型企业'
          },
          {
            '10001': '利润',
            '10002': '70445.662',
            '10003': '241216184524142',
            '20001': '小型企业-利润',
            '241216184524142': '70445.662',
            '241216184524145': '2019',
            '241216184524148': '小型企业'
          },
          {
            '10001': '销售额',
            '10002': '1209267.4509999994',
            '10003': '241216184524139',
            '20001': '消费者-销售额',
            '241216184524139': '1209267.4509999994',
            '241216184524145': '2019',
            '241216184524148': '消费者'
          },
          {
            '10001': '利润',
            '10002': '130523.21100000004',
            '10003': '241216184524142',
            '20001': '消费者-利润',
            '241216184524142': '130523.21100000004',
            '241216184524145': '2019',
            '241216184524148': '消费者'
          },
          {
            '10001': '销售额',
            '10002': '1194097.982',
            '10003': '241216184524139',
            '20001': '公司-销售额',
            '241216184524139': '1194097.982',
            '241216184524145': '2020',
            '241216184524148': '公司'
          },
          {
            '10001': '利润',
            '10002': '156066.722',
            '10003': '241216184524142',
            '20001': '公司-利润',
            '241216184524142': '156066.722',
            '241216184524145': '2020',
            '241216184524148': '公司'
          },
          {
            '10001': '销售额',
            '10002': '612662.176',
            '10003': '241216184524139',
            '20001': '小型企业-销售额',
            '241216184524139': '612662.176',
            '241216184524145': '2020',
            '241216184524148': '小型企业'
          },
          {
            '10001': '利润',
            '10002': '70031.83600000002',
            '10003': '241216184524142',
            '20001': '小型企业-利润',
            '241216184524142': '70031.83600000002',
            '241216184524145': '2020',
            '241216184524148': '小型企业'
          },
          {
            '10001': '销售额',
            '10002': '1547854.518',
            '10003': '241216184524139',
            '20001': '消费者-销售额',
            '241216184524139': '1547854.518',
            '241216184524145': '2020',
            '241216184524148': '消费者'
          },
          {
            '10001': '利润',
            '10002': '224529.71799999976',
            '10003': '241216184524142',
            '20001': '消费者-利润',
            '241216184524142': '224529.71799999976',
            '241216184524145': '2020',
            '241216184524148': '消费者'
          },
          {
            '10001': '销售额',
            '10002': '751827.4890000003',
            '10003': '241216184524139',
            '20001': '小型企业-销售额',
            '241216184524139': '751827.4890000003',
            '241216184524145': '2021',
            '241216184524148': '小型企业'
          },
          {
            '10001': '利润',
            '10002': '104185.24900000016',
            '10003': '241216184524142',
            '20001': '小型企业-利润',
            '241216184524142': '104185.24900000016',
            '241216184524145': '2021',
            '241216184524148': '小型企业'
          },
          {
            '10001': '销售额',
            '10002': '1232049.7069999985',
            '10003': '241216184524139',
            '20001': '公司-销售额',
            '241216184524139': '1232049.7069999985',
            '241216184524145': '2021',
            '241216184524148': '公司'
          },
          {
            '10001': '利润',
            '10002': '170255.82699999984',
            '10003': '241216184524142',
            '20001': '公司-利润',
            '241216184524142': '170255.82699999984',
            '241216184524145': '2021',
            '241216184524148': '公司'
          },
          {
            '10001': '销售额',
            '10002': '2009897.834',
            '10003': '241216184524139',
            '20001': '消费者-销售额',
            '241216184524139': '2009897.834',
            '241216184524145': '2021',
            '241216184524148': '消费者'
          },
          {
            '10001': '利润',
            '10002': '297288.05400000047',
            '10003': '241216184524142',
            '20001': '消费者-利润',
            '241216184524142': '297288.05400000047',
            '241216184524145': '2021',
            '241216184524148': '消费者'
          },
          {
            '10001': '销售额',
            '10002': '1707242.6979999992',
            '10003': '241216184524139',
            '20001': '公司-销售额',
            '241216184524139': '1707242.6979999992',
            '241216184524145': '2022',
            '241216184524148': '公司'
          },
          {
            '10001': '利润',
            '10002': '198663.45799999998',
            '10003': '241216184524142',
            '20001': '公司-利润',
            '241216184524142': '198663.45799999998',
            '241216184524145': '2022',
            '241216184524148': '公司'
          },
          {
            '10001': '销售额',
            '10002': '2849279.1179999993',
            '10003': '241216184524139',
            '20001': '消费者-销售额',
            '241216184524139': '2849279.1179999993',
            '241216184524145': '2022',
            '241216184524148': '消费者'
          },
          {
            '10001': '利润',
            '10002': '378567.09799999924',
            '10003': '241216184524142',
            '20001': '消费者-利润',
            '241216184524142': '378567.09799999924',
            '241216184524145': '2022',
            '241216184524148': '消费者'
          },
          {
            '10001': '销售额',
            '10002': '972806.0580000003',
            '10003': '241216184524139',
            '20001': '小型企业-销售额',
            '241216184524139': '972806.0580000003',
            '241216184524145': '2022',
            '241216184524148': '小型企业'
          },
          {
            '10001': '利润',
            '10002': '146603.898',
            '10003': '241216184524142',
            '20001': '小型企业-利润',
            '241216184524142': '146603.898',
            '241216184524145': '2022',
            '241216184524148': '小型企业'
          },
          {
            '10001': '销售额',
            '10002': '309016.701',
            '10003': '241216184524139',
            '20001': '公司-销售额',
            '241216184524139': '309016.701',
            '241216184524145': '2023',
            '241216184524148': '公司'
          },
          {
            '10001': '利润',
            '10002': '60240.901000000005',
            '10003': '241216184524142',
            '20001': '公司-利润',
            '241216184524142': '60240.901000000005',
            '241216184524145': '2023',
            '241216184524148': '公司'
          },
          {
            '10001': '销售额',
            '10002': '151814.09599999996',
            '10003': '241216184524139',
            '20001': '小型企业-销售额',
            '241216184524139': '151814.09599999996',
            '241216184524145': '2023',
            '241216184524148': '小型企业'
          },
          {
            '10001': '利润',
            '10002': '21212.016',
            '10003': '241216184524142',
            '20001': '小型企业-利润',
            '241216184524142': '21212.016',
            '241216184524145': '2023',
            '241216184524148': '小型企业'
          },
          {
            '10001': '销售额',
            '10002': '408773.2670000001',
            '10003': '241216184524139',
            '20001': '消费者-销售额',
            '241216184524139': '408773.2670000001',
            '241216184524145': '2023',
            '241216184524148': '消费者'
          },
          {
            '10001': '利润',
            '10002': '22184.54699999999',
            '10003': '241216184524142',
            '20001': '消费者-利润',
            '241216184524142': '22184.54699999999',
            '241216184524145': '2023',
            '241216184524148': '消费者'
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
            domain: ['公司-销售额', '小型企业-销售额', '消费者-销售额', '公司-利润', '小型企业-利润', '消费者-利润'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '241216184524139': {
            alias: '销售额'
          },
          '241216184524142': {
            alias: '利润'
          },
          '241216184524145': {
            alias: '订单日期',
            domain: ['2019', '2020', '2021', '2022', '2023'],
            sortIndex: 0,
            lockStatisticsByDomain: true
          },
          '241216184524148': {
            alias: '细分'
          }
        }
      }
    ],
    stackInverse: true,
    axes: [
      {
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
        orient: 'left',
        visible: true,
        domainLine: {
          visible: true,
          style: {
            lineWidth: 1,
            stroke: '#989999'
          }
        },
        title: {
          visible: false,
          space: 5,
          text: '订单日期',
          style: {
            fontSize: 12,
            fill: '#363839',
            fontWeight: 'normal'
          }
        },
        maxHeight: null,
        autoIndent: false,
        sampling: false,
        zIndex: 200,
        label: {
          visible: true,
          space: 8,
          style: {
            fontSize: 12,
            fill: '#6F6F6F',
            angle: 0,
            fontWeight: 'normal',
            direction: 'horizontal',
            maxLineWidth: 174
          },
          autoHide: true,
          autoHideMethod: 'greedy',
          flush: true,
          lastVisible: true
        },
        hover: true,
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
        paddingInner: [0.15, 0.1],
        paddingOuter: [0.075, 0.1]
      },
      {
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
        orient: 'bottom',
        visible: true,
        domainLine: {
          visible: true,
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
        autoIndent: false,
        sampling: false,
        label: {
          visible: true,
          space: 4,
          flush: true,
          padding: 0,
          style: {
            fontSize: 12,
            maxLineWidth: 174,
            fill: '#6F6F6F',
            angle: 0,
            fontWeight: 'normal',
            dy: 0,
            direction: 'horizontal'
          },
          autoHide: true,
          autoHideMethod: 'greedy'
        },
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
        nice: true
      }
    ],
    color: {
      field: '20001',
      type: 'ordinal',
      range: ['#2E62F1', '#4DC36A', '#FF8406', '#FFCC00', '#4F44CF', '#5AC8FA'],
      specified: {},
      domain: ['公司-销售额', '小型企业-销售额', '消费者-销售额', '公司-利润', '小型企业-利润', '消费者-利润']
    },
    legends: [
      {
        type: 'discrete',
        visible: true,
        id: 'legend-discrete',
        orient: 'bottom',
        position: 'middle',
        layoutType: 'normal',
        maxRow: 1,
        title: {
          textStyle: {
            fontSize: 12,
            fill: '#6F6F6F'
          }
        },
        layoutLevel: 30,
        item: {
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
          label: {
            style: {
              fontSize: 12,
              fill: '#6F6F6F'
            }
          },
          shape: {
            style: {
              lineWidth: 0,
              symbolType: 'square',
              size: 10,
              fillOpacity: 1
            }
          }
        },
        pager: {
          type: 'default',
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
        alignSelf: 'start',
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
      offset: 3,
      overlap: {
        hideOnHit: true,
        avoidBaseMark: false,
        strategy: [
          {
            type: 'position',
            position: []
          }
        ],
        clampForce: true
      },
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        zIndex: 400,
        lineHeight: '100%',
        boundsPadding: [1, 0, 0, 0],
        fill: '#363839',
        stroke: 'rgba(255, 255, 255, 0.8)',
        lineWidth: 2,
        strokeOpacity: 1
      },
      position: 'outside',
      smartInvert: false
    },
    tooltip: {
      handler: {}
    },
    hover: {
      enable: true
    },
    select: {
      enable: true
    },
    bar: {
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
        selected_reverse: {
          fillOpacity: 0.3,
          lineWidth: 0.3
        }
      },
      style: {
        cornerRadius: 0
      }
    },
    region: [
      {
        clip: true
      }
    ],
    background: 'rgba(255, 255, 255, 0)',
    animation: false,
    brush: {
      inBrush: {
        fillOpacity: 1,
        stroke: '#58595B',
        lineWidth: 1,
        strokeOpacity: 1,
        colorAlpha: 1
      },
      outOfBrush: {
        colorAlpha: 0.2,
        fillOpacity: 0.3,
        lineWidth: 0.3
      },
      endTrigger: ['pointerup', 'pointerupoutside']
    },
    crosshair: {
      yField: {
        visible: true,
        line: {
          type: 'rect',
          style: {
            fillOpacity: 0.2,
            fill: '#b2bacf'
          }
        }
      },
      gridZIndex: 100
    },
    hash: 'a1fc9f11b63b517f25ee509322421bb5'
  };

  const cs4 = new VChart(spec4, {
    dataSet,
    dom: document.getElementById('chart'),
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs4.renderAsync().then(() => {
    console.timeEnd('renderTime');
    cs4.on('brushStart', (...e) => console.log('brushStart-4', e));
    cs4.on('brushEnd', (...e) => console.log('brushEnd-4', e));
    cs4.on('brushClear', (...e) => console.log('brushClear-4', e));
    cs4.on('brushActive', (...e) => console.log('brushActive-4', e));
  });
};
run();
