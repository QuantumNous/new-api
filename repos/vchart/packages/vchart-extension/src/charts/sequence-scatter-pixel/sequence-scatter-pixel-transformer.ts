import type { Datum } from '@visactor/vchart/src/typings';
import type { ISequenceScatterPixelSpec } from './interface';
import { CommonChartSpecTransformer } from '@visactor/vchart';
import { processSequenceData } from './utils';
import { DATA_KEY } from './constant';

export class SequenceScatterPixelChartSpecTransformer extends CommonChartSpecTransformer<any> {
  transformSpec(spec: any): void {
    super.transformSpec(spec);
    const dataSpecs = processSequenceData(spec as unknown as ISequenceScatterPixelSpec);

    spec.type = 'common';
    spec.dataKey = DATA_KEY;
    spec.data = dataSpecs[0].data;

    spec.width = 300;
    spec.height = 300;
    spec.autoFit = false;

    spec.series = [
      {
        type: 'scatter',
        xField: spec.xField,
        yField: spec.yField
      }
    ];

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
        type: 'linear'
      },
      {
        orient: 'bottom',
        label: { visible: true },
        type: 'linear'
      }
    ];

    spec.customMark = [
      // 背景图像
      {
        type: 'image',
        dataIndex: 2,
        style: {
          x: 0,
          y: 0,
          width: 300,
          height: 300,
          image: (datum: Datum) => datum.imageData,
          zIndex: -1
        }
      },
      {
        type: 'text',
        dataIndex: 1,
        style: {
          text: (datum: Datum) => datum.inter,
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

    spec.tooltip = {
      visible: false
    };

    super.transformSpec(spec);
  }
}
