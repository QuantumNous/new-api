import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';
import { dataRegister } from '../../../data/data-sequence-register';
import { dataIm } from '../../../data/data-sequence-im';
import { dataEventDot } from '../../../data/data-sequence-event-dot';
import { dataEventLink } from '../../../data/data-sequence-event-link';
import { dataComment } from '../../../data/data-sequence-comment';
const run = () => {
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
  const barStyle = {
    bar: {
      style: {
        stroke: 'orange',
        lineWidth: 1,
        fill: {
          gradient: 'linear',
          x0: 0.5,
          y0: 0,
          x1: 0.5,
          y1: 1,
          stops: [
            {
              offset: 0,
              color: '#F0B89E'
            },
            {
              offset: 1,
              color: '#FEFFAA'
            }
          ]
        }
      }
    }
  };
  const dataZoomStyle = {
    selectedBackground: {
      style: {
        fill: '#B0C8F9',
        fillOpacity: 0.5
      }
    },
    dragMask: {
      style: {
        fill: '#B0C8F9',
        fillOpacity: 0.2
      }
    },
    backgroundChart: {
      area: {
        style: {
          lineWidth: 1,
          fill: '#F6F8FC'
        }
      },
      line: {
        style: {
          stroke: '#D1DBEE',
          lineWidth: 1
        }
      }
    },
    selectedBackgroundChart: {
      area: {
        style: {
          lineWidth: 1,
          fill: '#fbb934'
        }
      },
      line: {
        style: {
          stroke: '#fbb934',
          lineWidth: 1
        }
      }
    }
  };
  const seriesStyleMap = {
    registry_device: '#7568D9',
    im: '#5EC9C8',
    comment: '#FF8F62',
    other: '#E95A23'
  };
  const seriesStyleCallback = datum => {
    if (datum.action_type) {
      if (seriesStyleMap[datum.action_type]) {
        return seriesStyleMap[datum.action_type];
      }
      return seriesStyleMap['other'];
    }
  };

  const seriesGroupStyleMap = {
    uid: '#54BA00',
    user_id: '#A29BFE',
    IP: '#D6331C',
    user_email: '#ED9330',
    user_did: '#F68484',
    user_mobile: '#5383F4',
    user_third_party_id: '#2CB4A8',
    user_nature_people_id: '#80D8FB',
    other: '#E95A23'
  };

  const seriesGroupStyleCallback = datum => {
    if (datum.type) {
      if (seriesGroupStyleMap[datum.type]) {
        return seriesGroupStyleMap[datum.type];
      }
      return seriesGroupStyleMap['other'];
    }
  };

  const spec = {
    type: 'sequence',
    appendPadding: {
      left: 80,
      right: 0
    },
    background: '#EEEEEE',
    series: [
      {
        type: 'bar',
        barTitle: 'register',
        dataId: 'register',
        xField: 'start_time',
        x2Field: 'end_time',
        yField: 'value',
        animation: false,
        label: {
          style: {
            visible: false,
            fill: 'black'
          }
        },
        height: 40,
        padding: 10,
        tooltip: {
          visible: true,
          mark: {
            title: {
              key: 'bar info',
              value: 'bar info'
            },
            content: [
              {
                key: 'start_time',
                value: datum => datum['start_time']
              },
              {
                key: 'start_time_stamp',
                hasShape: false,
                value: datum => datum['start_time']
              },
              {
                key: 'end_time',
                value: datum => datum['end_time']
              },
              {
                key: 'end_time_stamp',
                hasShape: false,
                value: datum => datum['end_time']
              },
              {
                key: 'value',
                value: datum => datum['value']
              }
            ]
          }
        },
        ...barStyle
      },
      {
        type: 'bar',
        barTitle: 'im',
        dataId: 'im',
        xField: 'start_time',
        x2Field: 'end_time',
        yField: 'value',
        animation: false,
        height: 40,
        padding: 10,
        tooltip: {
          visible: true,
          mark: {
            title: {
              key: 'bar info',
              value: 'bar info'
            },
            content: [
              {
                key: 'start_time',
                value: datum => datum['start_time']
              },
              {
                key: 'start_time_stamp',
                hasShape: false,
                value: datum => datum['start_time']
              },
              {
                key: 'end_time',
                value: datum => datum['end_time']
              },
              {
                key: 'end_time_stamp',
                hasShape: false,
                value: datum => datum['end_time']
              },
              {
                key: 'value',
                value: datum => datum['value']
              }
            ]
          }
        },
        ...barStyle
      },
      {
        type: 'bar',
        barTitle: 'comment',
        dataId: 'comment',
        xField: 'start_time',
        x2Field: 'end_time',
        yField: 'value',
        animation: false,
        height: 40,
        padding: 10,
        tooltip: {
          visible: true,
          mark: {
            title: {
              key: 'bar info',
              value: 'bar info'
            },
            content: [
              {
                key: 'start_time',
                value: datum => datum['start_time']
              },
              {
                key: 'start_time_stamp',
                hasShape: false,
                value: datum => datum['start_time']
              },
              {
                key: 'end_time',
                value: datum => datum['end_time']
              },
              {
                key: 'end_time_stamp',
                hasShape: false,
                value: datum => datum['end_time']
              },
              {
                key: 'value',
                value: datum => datum['value']
              }
            ]
          }
        },
        ...barStyle
      },
      {
        type: 'dot',
        dataId: 'dataDotSeries',
        xField: 'event_time',
        yField: 'id',
        seriesGroupField: 'type',
        seriesField: 'action_type',
        titleField: 'type',
        subTitleField: 'id',
        dotTypeField: 'action_type',
        highLightSeriesGroup: 'IP',
        clipHeight: 1000,
        dot: {
          state: {
            hover: {
              fill: 'rgba(255,215,0,0.8)'
            }
          },
          style: {
            fill: seriesStyleCallback
          }
        },
        title: {
          style: {
            fill: 'rgba(46, 47, 50)'
          }
        },
        subTitle: {
          style: {
            fill: 'rgba(46, 47, 50)',
            dy: 7
            // text: (datum) => datum['id'].length > 7? datum['id'].substring(0,7)+'...' : datum['id']
          }
        },
        symbol: {
          style: {
            dx: -30,
            fill: seriesGroupStyleCallback
          }
        },
        grid: {
          style: {
            stroke: seriesGroupStyleCallback
          },
          background: {
            fill: '#000',
            fillOpacity: 0.4
          }
        },
        tooltip: {
          mark: {
            title: {
              key: 'event info',
              value: 'event info'
            },
            content: [
              {
                hasShape: true,
                shapeType: 'square',
                key: datum => datum['type'],
                value: datum => datum['id']
              },
              {
                hasShape: false,
                key: 'event_time_stamp',
                value: datum => datum['event_time']
              },
              {
                hasShape: true,
                shapeType: 'square',
                key: 'action_type',
                value: datum => datum['action_type']
              },
              {
                hasShape: true,
                shapeType: 'square',
                key: 'children',
                value: datum => datum['children']
              }
            ]
          }
        }
      },
      {
        type: 'link',
        dataId: 'dataLinkSeries',
        dotSeriesIndex: 3,
        fromField: 'from',
        toField: 'to',
        dotTypeField: 'action_type',
        seriesField: 'action_type',
        link: {
          style: {
            stroke: seriesStyleCallback
          }
        },
        arrow: {
          style: {
            fill: seriesStyleCallback
          }
        },
        tooltip: {
          mark: {
            title: {
              key: 'link info',
              value: 'link info'
            },
            content: [
              {
                hasShape: true,
                shapeType: 'square',
                key: 'time',
                value: datum => datum['from'].split('_')[1]
              },
              {
                hasShape: false,
                key: 'time_stamp',
                value: datum => datum['from'].split('_')[1]
              },
              {
                hasShape: true,
                shapeType: 'square',
                key: 'type',
                value: datum => datum['action_type']
              },
              {
                hasShape: true,
                shapeType: 'square',
                key: 'from',
                value: datum => datum['from']
              },
              {
                hasShape: true,
                shapeType: 'square',
                key: 'to',
                value: datum => datum['to']
              }
            ]
          }
        }
      }
    ],
    dataZoom: [
      {
        orient: 'top',
        xAxisIndex: 0,
        regionIndex: [1, 2, 3, 4],
        start: 0.1,
        end: 0.3,
        filterMode: 'axis',
        startText: {
          formatMethod: text => Math.floor(text)
        },
        endText: {
          formatMethod: text => Math.floor(text)
        },
        ...dataZoomStyle
      }
    ],
    scrollBar: {
      roam: true
    },
    axes: [
      {
        orient: 'top',
        type: 'time',
        grid: {
          visible: false
        },
        layers: [
          {
            tickStep: 28800,
            timeFormat: '%H:%M'
          },
          {
            tickStep: 86400,
            timeFormat: '%Y%m%d'
          }
        ]
      }
    ],
    legends: [
      {
        visible: true,
        orient: 'top',
        // height: 40,
        // offsetX: 400,
        // padding: 100,
        item: {
          visible: true,
          maxRow: 1
        },
        label: {
          visible: true,
          style: {
            // fill: colorMode === 'light' ? '#000' : '#FFF',
            fontSize: 12
          }
        }
      }
    ],
    data: [
      {
        id: 'register',
        values: [
          {
            start_time: 1662300000,
            end_time: 1662303600,
            value: 1
          },
          {
            start_time: 1662501600,
            end_time: 1662505200,
            value: 1
          }
        ]
      },
      {
        id: 'im',
        values: dataIm
      },
      {
        id: 'comment',
        values: dataComment
      },
      {
        id: 'dataDotSeries',
        values: []
      },
      {
        id: 'dataLinkSeries',
        values: []
      }
    ]
  };

  const cs = new VChart(spec, {
    dataSet,
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
