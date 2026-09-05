import type { Datum } from '@visactor/vchart/src/typings';
import type { ISequenceScatterLinkSpec } from './interface';
import { CommonChartSpecTransformer } from '@visactor/vchart';

const DATA_KEY = 'dataKey';

/**
 * convert ISequenceScatterLinkSpec to CommonSpec
 */
export class SequenceScatterLinkChartSpecTransformer extends CommonChartSpecTransformer<any> {
  transformSpec(spec: any): void {
    super.transformSpec(spec);
    const dataSpecs = processSequenceData(spec as unknown as ISequenceScatterLinkSpec);
    const showTooltip = spec.taskType !== 'neighborhood';

    spec.type = 'common';

    // data
    spec.dataKey = DATA_KEY;
    spec.data = dataSpecs[0].data;

    // series: background, line, scatter
    spec.series = [
      {
        id: 'background-series',
        type: 'area',
        dataId: 'background',
        interactive: false,
        persent: true,
        xField: 'x',
        yField: 'y',
        point: {
          visible: false
        },
        line: {
          visible: false
        },
        area: {
          visible: true,
          interactive: false,
          style: {
            background: (datum: { iter: number }) => {
              if (spec.taskType === 'neighborhood') {
                return '';
              }
              return `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter-bgimg-2/${datum.iter}.png`;
            },
            fill: 'transparent',
            fillOpacity: 0.5
          }
        },
        hover: {
          enable: false
        },
        select: {
          enable: false
        }
      },
      {
        id: 'line-series',
        type: 'line',
        dataId: 'endpoints',
        xField: 'x',
        yField: 'y',
        seriesField: 'edgeId', // a line will be drawn between endpoints with the same edgeId.
        animation: true,
        point: {
          visible: false
        },
        line: {
          visible: true,
          style: {
            stroke: (datum: { color: string }) => {
              return datum.color;
            },
            lineDash: (datum: { type: string }) => {
              if (datum.type === 'same_type') {
                return [0, 0];
              }
              return [3, 2];
            },
            lineWidth: 0.8,
            strokeOpacity: 0.6
          }
        }
      },
      {
        id: 'scatter-series',
        type: 'scatter',
        dataId: 'nodes',
        xField: spec.xField,
        yField: spec.yField,
        seriesField: 'label',
        point: {
          state: {
            hover: {
              scaleX: 1.5,
              scaleY: 1.5,
              fillOpacity: 1
            },
            hover_reverse: {
              scaleX: 1,
              scaleY: 1,
              fillOpacity: 0.3
            }
          },
          style: {
            size: () => {
              return spec.taskType === 'neighborhood' ? 6 : 4;
            },
            fill: (datum: { label: string }) => {
              const color = spec.labelColor[datum.label] ?? 'gray';
              return color;
            },
            fillOpacity: (datum: { confidence: number }) => {
              return datum.confidence;
            }
          }
        },
        label: {
          visible: true,
          style: {
            visible: () => {
              return spec.taskType === 'neighborhood';
            },
            type: 'text',
            fontFamily: 'Console',
            fontStyle: 'italic',
            fontSize: 12,
            fill: 'black',
            fillOpacity: 0.6,
            text: (datum: Datum) => {
              return datum.id;
            }
          }
        }
      }
    ];

    // player
    if (spec.player) {
      spec.player = {
        ...spec.player,
        specs: dataSpecs
      };
      spec.animationAppear = {
        duration: spec.player?.duration ?? 2000,
        easing: 'linear'
      };

      spec.animationUpdate = {
        duration: spec.player?.duration ?? 2000,
        easing: 'linear'
      };
    }

    // axes
    spec.axes = [
      {
        orient: 'left',
        type: 'linear',
        inverse: true,
        min: spec.scope[1],
        max: spec.scope[3]
      },
      {
        orient: 'bottom',
        type: 'linear',
        min: spec.scope[0],
        max: spec.scope[2]
      }
    ];

    // iteration label
    spec.customMark = [
      {
        type: 'text',
        dataId: 'iter',
        style: {
          x: 50,
          y: () => 10,
          textBaseline: 'top',
          textAlign: 'left',
          fontSize: 100,
          fontWeight: 'bolder',
          fill: 'black',
          fillOpacity: 0.2,
          ...spec.infoLabel?.style
        }
      }
    ];

    // legends
    (spec.legends = [
      {
        seriesId: 'scatter-series',
        visible: true,
        orient: 'right',
        position: 'middle',
        data: (items: any[]) => {
          return items.map(item => {
            item.shape.outerBorder = {
              stroke: item.shape.fill,
              distance: 2,
              lineWidth: 1
            };
            return item;
          });
        },
        title: {
          visible: true,
          align: 'left',
          textStyle: {
            text: 'Classes',
            fontFamily: 'Console',
            fontSize: 18,
            fontWeight: 'bold'
          }
        },
        item: {
          visible: true,
          width: '8%',
          value: {
            alignRight: true,
            style: {
              fill: '#000',
              fillOpacity: 1,
              fontSize: 12
            },
            state: {
              unselected: {
                fill: '#d8d8d8'
              }
            }
          }
        }
      }
    ]),
      // tooltip
      (spec.tooltip = {
        visible: showTooltip,
        seriesId: 'scatter-series',
        lockAfterClick: false,
        activeType: 'mark',
        trigger: 'hover',
        mark: {
          title: {
            visible: true,
            value: 'Info'
          },
          content: [
            {
              key: 'Label',
              value: (datum: { label: string }) => {
                return datum.label;
              },
              shapeType: 'circle',
              shapeSize: 8
            },
            {
              key: 'Prediction',
              value: (datum: { prediction: string }) => {
                return datum.prediction;
              },
              shapeType: 'circle',
              shapeSize: 8,
              shapeFill: (datum: { prediction: string }) => {
                const color = spec.labelColor[datum.prediction] ?? 'gray';
                return color;
              }
            },
            {
              key: 'Confidence',
              value: (datum: { confidence: number }) => {
                return datum.confidence.toFixed(2);
              },
              shapeType: 'square',
              shapeSize: 8,
              shapeFill: (datum: { label: string; prediction: string }) => {
                return datum.label === datum.prediction ? 'green' : 'red';
              }
            }
          ]
        },
        style: {
          panel: {
            padding: { top: 10, bottom: 15, left: 10, right: 10 },
            backgroundColor: '#fff',
            border: {
              color: '#eee',
              width: 1,
              radius: 10
            }
          },
          titleLabel: {
            fontSize: 20,
            fontFamily: 'Times New Roman',
            fill: 'brown',
            fontWeight: 'bold',
            textAlign: 'center',
            lineHeight: 24
          },
          keyLabel: {
            fontSize: 16,
            fontFamily: 'Times New Roman',
            fill: 'black',
            textAlign: 'center',
            lineHeight: 15,
            spacing: 10
          },
          valueLabel: {
            fontSize: 14,
            fill: 'black',
            textAlign: 'center',
            lineHeight: 15,
            spacing: 10
          }
        }
      });

    // datazoom
    spec.dataZoom = [
      {
        visible: false,
        orient: 'left',
        filterMode: 'axis',
        showDetail: false,
        roamZoom: {
          enable: true,
          focus: true,
          rate: 3
        },
        roamDrag: {
          enable: true,
          reverse: true,
          rate: 1
        }
      },
      {
        visible: false,
        orient: 'bottom',
        filterMode: 'axis',
        showDetail: false,
        roamZoom: {
          enable: true,
          focus: true,
          rate: 3
        },
        roamDrag: {
          enable: true,
          reverse: true,
          rate: 1
        }
      }
    ];

    super.transformSpec(spec);
  }
}

/**
 * convert ISequenceScatterLinkData to IScatterData
 */
export function processSequenceData(spec: ISequenceScatterLinkSpec) {
  const result: any[] = [];
  Object.keys(spec.data).forEach(iter => {
    const nodes = spec.data[iter].nodes;
    result.push({
      data: [
        {
          id: 'nodes',
          values: nodes.map((d, i) => {
            return { ...d, [DATA_KEY]: i };
          })
        },
        {
          id: 'endpoints',
          values: [] // dynamically filled in events
        },
        {
          id: 'iter',
          values: [
            {
              iter
            }
          ]
        },
        {
          id: 'background',
          values: [
            { iter: iter, x: spec.scope[0], y: spec.scope[1] },
            { iter: iter, x: spec.scope[0], y: spec.scope[3] },
            { iter: iter, x: spec.scope[2], y: spec.scope[3] },
            { iter: iter, x: spec.scope[2], y: spec.scope[1] },
            { iter: iter, x: spec.scope[0], y: spec.scope[1] }
          ]
        }
      ]
    });
  });
  return result;
}
