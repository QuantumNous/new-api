import type { Datum } from '@visactor/vchart/src/typings';
import type { ISequenceScatterKDESpec } from './interface';
import { CommonChartSpecTransformer } from '@visactor/vchart';
import type { Point } from './interface';
import { calculateKDE } from './utils';

const DATA_KEY = 'dataKey';

export class SequenceScatterKDEChartSpecTransformer extends CommonChartSpecTransformer<any> {
  transformSpec(spec: any): void {
    super.transformSpec(spec);
    const dataSpecs = processSequenceData(spec as unknown as ISequenceScatterKDESpec);

    spec.type = 'common';
    spec.dataKey = DATA_KEY;
    spec.data = dataSpecs[0].data;

    spec.scales = [
      {
        id: 'colorScale',
        type: 'ordinal',
        specified: {
          '0': 'rgb(150, 10, 100)',
          '1': 'rgb(31, 119, 180)',
          '2': 'rgb(255, 127, 14)',
          '3': 'rgb(44, 160, 44)',
          '4': 'rgb(214, 39, 40)',
          '5': 'rgb(148, 103, 189)',
          '6': 'rgb(140, 86, 75)',
          '7': 'rgb(227, 119, 194)',
          '8': 'rgb(127, 127, 127)',
          '9': 'rgb(188, 189, 34)',
          '10': 'rgb(23, 190, 207)'
        }
      },
      {
        id: 'brighterColorScale',
        type: 'ordinal',
        specified: {
          '0': 'rgb(150, 10, 150)',
          '1': 'rgb(31, 119, 230)',
          '2': 'rgb(255, 127, 64)',
          '3': 'rgb(44, 160, 94)',
          '4': 'rgb(214, 39, 90)',
          '5': 'rgb(148, 103, 239)',
          '6': 'rgb(140, 86, 125)',
          '7': 'rgb(227, 119, 244)',
          '8': 'rgb(127, 127, 177)',
          '9': 'rgb(188, 189, 84)',
          '10': 'rgb(23, 190, 255)'
        }
      },
      ...(spec.scales ?? [])
    ];
    spec.series = [
      {
        type: 'scatter',
        dataIndex: 0,
        xField: spec.xField,
        yField: spec.yField,
        seriesField: spec.seriesField,
        size: 5,
        point: {
          zIndex: 1000,
          style: {
            fill: {
              scale: 'colorScale',
              field: spec.seriesField
            }
          }
        }
      }
    ];
    // spec.width = 800;
    // spec.height = 500;

    // 获取图元位置
    const regionX = 54;
    const regionY = 26;

    spec.customMark = [
      {
        type: 'text',
        dataIndex: 1,
        style: {
          text: (datum: Datum) => datum.iter,
          x: 10,
          y: () => 10,
          textBaseline: 'top',
          textAlign: 'left',
          fontSize: 25,
          fontWeight: 'bolder',
          fill: 'black',
          fillOpacity: 0.2,
          ...spec.infoLabel?.style
        }
      },
      {
        type: 'symbol',
        dataIndex: 2,
        style: {
          symbolType: 'rect',
          x: (datum: any, ctx: any) => {
            // 获取region位置
            // const regionStartPoint = ctx.chart.getAllRegions()[0].getLayoutStartPoint();
            // const { x: regionX } = regionStartPoint;
            // 获取图元位置
            const valueToX = ctx.chart.getAllSeries()[0]._markAttributeContext.valueToX;
            const markX = valueToX([datum.x]);
            return regionX + markX;
          },
          y: (datum: any, ctx: any) => {
            const valueToY = ctx.chart.getAllSeries()[0]._markAttributeContext.valueToY;
            const markY = valueToY([datum.y]);
            return markY + regionY;
          },
          size: 5,
          fill: {
            scale: 'brighterColorScale',
            field: 'label'
          },
          fillOpacity: (datum: any) => datum.kde * 10
        }
      }
    ];

    spec.tooltip = {
      visible: true,
      fields: ['x', 'y', 'label']
    };

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

    spec.axes = [
      {
        orient: 'left',
        type: 'linear',
        nice: true
      },
      {
        orient: 'bottom',
        type: 'linear',
        nice: true,
        label: { visible: true }
      }
    ];

    super.transformSpec(spec);
  }
}

export function processSequenceData(spec: ISequenceScatterKDESpec) {
  const result: any[] = [];
  Object.keys(spec.data).forEach(iter => {
    const currentData = spec.data[iter].map((d: Datum, i) => ({
      ...(d as Point),
      [DATA_KEY]: i
    }));

    const kdeResults = calculateKDE(currentData, 150);
    result.push({
      data: [
        {
          id: 'nodes',
          values: currentData
        },
        {
          id: 'iter',
          values: [{ iter }]
        },
        {
          id: 'kde',
          values: kdeResults
        }
      ]
    });
  });
  return result;
}
