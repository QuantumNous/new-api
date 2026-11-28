import type { IRankingBarSpec } from './interface';
import type { ICartesianAxisSpec, ICommonChartSpec, ILabelSpec, ITextGraphicAttribute } from '@visactor/vchart';
import { BaseChartSpecTransformer, isValid } from '@visactor/vchart';

export class RankingBarChartSpecTransformer<T extends ICommonChartSpec> extends BaseChartSpecTransformer<any> {
  transformSpec(spec: T): void {
    const { timeData, timeNodes } = processData(spec as unknown as IRankingBarSpec);
    const {
      interval: userInterval,
      xField,
      yField,
      color,
      icon,
      iconPosition,
      iconShape,
      timeLabel,
      label,
      nameLabel,
      xAxis,
      yAxis
    } = spec as unknown as IRankingBarSpec;

    const interval = userInterval ? userInterval : 1000;
    const exchangeDuration = Math.min(interval, 500);

    spec.type = 'common';
    spec.data = [
      {
        id: 'timeData',
        values: timeData.get(timeNodes[0])
      },
      {
        id: 'time',
        values: [{ time: timeNodes[0] }]
      }
    ];

    // @ts-ignore FIXME: type definition
    spec.color = {
      specified: {
        ...color
      }
    };
    spec.region = [{ clip: true }];
    spec.series = [
      {
        type: 'bar',
        id: 'ranking-bar',
        dataId: 'timeData',
        direction: 'horizontal',
        yField,
        xField,
        seriesField: yField,
        extensionMark: [],
        label: labelSpec(label, { ...nameLabel, yField }) as any
      }
    ];
    spec.axes = axisSpec(xAxis, yAxis);
    spec.player = {
      type: 'continuous',
      auto: true,
      loop: false,
      interval,
      specs: timeNodes.map(time => ({
        data: [
          { id: 'timeData', values: timeData.get(time) },
          { id: 'time', values: [{ time }] }
        ]
      }))
    };
    spec.tooltip = { visible: false };
    spec.customMark = [];

    transformAnimationSpec(spec, { interval, exchangeDuration });

    if (!timeLabel || timeLabel.visible !== false) {
      spec.customMark.push(timeLabelSpec(timeLabel.style) as any);
    }
    if (icon) {
      const icon = iconSpec(iconPosition, iconShape, { interval, exchangeDuration });
      spec.series[0].extensionMark.push(icon as any);
    }

    super.transformSpec(spec);
  }
}

export function processData(spec: IRankingBarSpec) {
  const { xField, yField, timeField, data, topN = 10, icon } = spec;

  // 数据处理
  const timeNodes = new Set<string>();
  const timeData = new Map();

  data.sort((d1, d2) => Number(d2[xField]) - Number(d1[xField]));

  data.forEach(d => {
    const time = d[timeField];
    if (isValid(time)) {
      timeNodes.add(time);
    }
    if (!timeData.has(time)) {
      timeData.set(time, []);
    }
    const currentData = timeData.get(time);
    if (currentData.length < topN) {
      const _d = { ...d };
      if (icon && icon[_d[yField]]) {
        _d.icon = icon[_d[yField]];
      }
      currentData.push(_d);
    }
  });

  return { timeData, timeNodes: Array.from(timeNodes).sort() };
}

function transformAnimationSpec(
  spec: ICommonChartSpec,
  { interval, exchangeDuration }: { interval: number; exchangeDuration: number }
) {
  (spec as any).animationAppear = false;
  (spec as any).animationUpdate = {
    bar: [
      {
        type: 'update',
        options: { excludeChannels: ['y'] },
        easing: 'linear',
        duration: interval
      },
      {
        channel: ['y'],
        easing: 'circInOut',
        duration: exchangeDuration
      }
    ],
    axis: {
      duration: interval,
      easing: 'linear'
    }
  };
  (spec as any).animationEnter = {
    bar: [
      {
        type: 'moveIn',
        duration: exchangeDuration,
        easing: 'cubicInOut',
        options: {
          direction: 'y',
          orient: 'negative',
          point: (datum: any, element: any, param: any) => {
            return {
              y: param.groupHeight + element.getBounds().height()
            };
          }
        }
      }
    ]
  };
  (spec as any).animationExit = {
    bar: [
      {
        type: 'moveOut',
        duration: exchangeDuration,
        easing: 'cubicInOut',
        options: {
          direction: 'y',
          orient: 'negative'
        }
      }
    ]
  };
}

function labelSpec(label: IRankingBarSpec['label'] = {}, nameLabel: IRankingBarSpec['nameLabel'] & { yField: string }) {
  const spec: ILabelSpec[] = [];

  if (label.visible !== false) {
    spec.push({
      visible: true,
      overlap: false,
      style: {
        // @ts-ignore
        fill: `rgb(64, 64, 64)`,
        ...label.style
      },
      smartInvert: {
        fillStrategy: label.style?.fill ? 'null' : undefined,
        strokeStrategy: label.style?.stroke ? 'null' : undefined
      }
    });
  }

  if (nameLabel.visible) {
    spec.push({
      visible: true,
      overlap: false,
      // @ts-ignore
      style: {
        ...nameLabel.style
      },
      smartInvert: {
        fillStrategy: nameLabel.style?.fill ? 'null' : undefined,
        strokeStrategy: nameLabel.style?.stroke ? 'null' : undefined
      },
      position: nameLabel.position === 'bar-end' ? 'inside-right' : 'inside-left',
      formatter: `{${nameLabel.yField}}`
    });
  }

  return spec;
}

function axisSpec(xAxis: IRankingBarSpec['xAxis'] = {}, yAxis: IRankingBarSpec['yAxis'] = {}) {
  const leftAxis: ICartesianAxisSpec = {
    orient: 'left',
    type: 'band',
    inverse: true,
    label: { style: yAxis.label as any },
    domainLine: { style: yAxis.domainLine },
    grid: { style: yAxis.grid as any }
  };
  const bottomAxis: ICartesianAxisSpec = {
    orient: 'bottom',
    type: 'linear',
    nice: false,
    animation: true,
    label: { style: xAxis.label as any },
    domainLine: { style: xAxis.domainLine },
    grid: { style: xAxis.grid as any },
    innerOffset: { right: '10%' }
  };

  if (xAxis.label) {
    bottomAxis.label = xAxis.label;
  }
  return [leftAxis, bottomAxis];
}

function timeLabelSpec(textStyle: ITextGraphicAttribute = {}) {
  return {
    type: 'text',
    dataId: 'time',
    style: {
      textBaseline: 'bottom',
      fontSize: 200,
      textAlign: 'end',
      fontWeight: 600,
      text: (datum: any) => datum.time,
      x: (datum: any, ctx: any) => {
        return ctx.vchart.getChart().getCanvasRect()?.width - 50;
      },
      y: (datum: any, ctx: any) => {
        return ctx.vchart.getChart().getCanvasRect()?.height - 80;
      },
      fill: 'grey',
      fillOpacity: 0.5,
      ...textStyle
    }
  };
}

function iconSpec(
  iconPosition: IRankingBarSpec['iconPosition'] = 'bar-end',
  iconShape: IRankingBarSpec['iconShape'] = 'circle',
  { interval, exchangeDuration }: any
) {
  return {
    type: 'symbol',
    dataId: 'timeData',
    style: {
      symbolType: iconShape,
      stroke: 'white',
      lineWidth: 1,
      size: (data: any, ctx: any) => {
        const vchart = ctx.vchart;
        const series = vchart.getChart()?.getSeriesInIndex(0)[0];
        if (vchart && series) {
          const bandwidth = series.getYAxisHelper().getBandwidth(0) ?? 0;
          return Math.max(bandwidth - 4, 0);
        }
        return 10;
      },
      background: (data: any) => data.icon,
      // globalZIndex 有bug，会有动画闪烁和报错
      // globalZIndex: 1, // 否则会被 region 区域 clip
      x: (data: any, ctx: any) => {
        const vchart = ctx.vchart;
        const series = vchart.getChart()?.getSeriesInIndex(0)[0];
        if (vchart && series) {
          const bandwidth = series.getYAxisHelper().getBandwidth(0) ?? 0;
          if (iconPosition === 'bar-start') {
            return bandwidth / 2;
          } else if (iconPosition === 'axis') {
            return -bandwidth / 2;
          }
          return series.dataToPositionX(data) - bandwidth / 2;
        }
        return undefined;
      },
      y: (data: any, ctx: any) => {
        const vchart = ctx.vchart;
        const series = vchart.getChart()?.getSeriesInIndex(0)[0];
        if (vchart && series) {
          const bandwidth = series.getYAxisHelper().getBandwidth(0) ?? 0;
          return series.dataToPositionY(data) + bandwidth / 2;
        }
        return undefined;
      },
      scaleY: iconShape === 'rect' ? 1.2 : 1
    },
    animationUpdate: customMarkUpdateAnimation(interval, exchangeDuration),
    animationEnter: [
      {
        type: 'moveIn',
        duration: exchangeDuration,
        easing: 'cubicInOut',
        options: {
          direction: 'y',
          orient: 'negative',
          point: (datum: any, element: any, param: any) => {
            return {
              y: param.groupHeight + element.getBounds().height()
            };
          }
        }
      }
    ],
    animationExit: [
      {
        type: 'moveOut',
        duration: exchangeDuration,
        easing: 'cubicInOut',
        options: {
          direction: 'y',
          orient: 'negative'
        }
      }
    ]
  };
}

function customMarkUpdateAnimation(duration: number, exchangeDuration: number) {
  return [
    {
      duration: exchangeDuration,
      easing: 'cubicInOut',
      channel: ['y']
    },
    {
      options: { excludeChannels: ['y'] },
      channel: ['x', 'x2', 'x1'],
      easing: 'linear',
      duration
    }
  ];
}
