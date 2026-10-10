import type { Datum } from '@visactor/vchart/src/typings';
import type { IRankingListSpec } from './interface';
import type { IMarkGraphic } from '@visactor/vchart';
import { CommonChartSpecTransformer } from '@visactor/vchart';
import { cloneDeep, TextMeasure } from '@visactor/vchart';
import { defaultSpec } from './constant';
import { applyVisible, computeDataRange, mergeObjects } from './utils';

const DATA_KEY = 'dataKey';
const ORDER_KEY = 'VCHART_ORDER';
const SUPPLY_DATA_KEY = 'SUPPLY_DATA_KEY';
const NAME_LABEL_PADDING_RIGHT = 10;
const NAME_ORDER_PADDING_RIGHT = 5;
const NAME_SYMBOL_PADDING_RIGHT = 8;
const CHART_PADDING_LEFT = 5;
const CHART_PADDING_RIGHT = 5;
const VALUE_LABEL_PADDING_LEFT = 5;

const LABEL_PADDING_BOTTOM = 5;

export class RankingListChartSpecTransformer extends CommonChartSpecTransformer {
  protected nameLabelTextMeasure: TextMeasure<any>;
  protected valueLabelTextMeasure: TextMeasure<any>;
  protected orderLabelTextMeasure: TextMeasure<any>;
  protected originalData: Datum[];
  protected originalSpec: IRankingListSpec;
  protected dataSpecs: any[];
  protected formatMap: { [key: string]: (text: string, ctx: any) => string } = {};
  protected orderCount: number;

  protected isSpecValid(spec: any) {
    const { xField, yField, data } = spec;
    if (!xField || !yField || !data || data.length === 0) {
      return false;
    }
    return true;
  }
  transformSpec(spec: any): void {
    super.transformSpec(spec);
    if (!this.isSpecValid(spec)) {
      spec.series = [];
      return;
    }

    this.normalizeSpec(spec);
    this.upgradeTextMeasure(spec);
    this.upgradeFormatMap(spec);
    this.processData(spec);

    // rankingList spec -> vchart spec
    this.transformBaseSpec(spec);
    this.transformAnimationSpec(spec);
    this.transformAxesSpec(spec);

    spec.extensionMark = [
      // 柱图背景
      this.generateBarBackground(spec),
      // 辅助图标
      ...this.generateDecorateHaloIcons(spec),
      // 左侧图标
      this.generateRankingIcon(spec),
      // 左侧label
      this.generateNameLabel(spec),
      // 左侧序号label
      this.generateOrderLabel(spec),
      // 右侧label
      this.generateValueLabel(spec)
    ];

    this.transformPaddingSpec(spec);

    // console.log('spec', spec);

    spec.customTransformSpec?.(spec);

    super.transformSpec(spec);
  }

  normalizeSpec(spec: any) {
    // 处理配置
    mergeObjects(spec, defaultSpec);
    applyVisible(spec, [
      'barBackground',
      'rankingIcon',
      'decorateHaloIcons',
      'orderLabel',
      'nameLabel',
      'valueLabel'
      // 'bar'
    ]);
  }

  upgradeTextMeasure(spec: any) {
    // 初始化文字测量
    this.nameLabelTextMeasure?.release();
    this.valueLabelTextMeasure?.release();
    this.orderLabelTextMeasure?.release();
    this.nameLabelTextMeasure = new TextMeasure({
      defaultFontParams: spec.nameLabel?.style ?? {}
    });
    this.valueLabelTextMeasure = new TextMeasure({
      defaultFontParams: spec.valueLabel?.style ?? {}
    });
    this.orderLabelTextMeasure = new TextMeasure({
      defaultFontParams: spec.orderLabel?.style ?? {}
    });
  }

  upgradeFormatMap(spec: any) {
    this.formatMap[spec.yField] = spec.nameLabel.formatMethod;
    this.formatMap[spec.xField] = spec.valueLabel.formatMethod;
    this.formatMap[ORDER_KEY] = spec.orderLabel.formatMethod;
  }

  processData(spec: any) {
    // ps: 如果updateSpec后, 同时执行2次processData会有问题, 在这里用比较hack的方式绕过第2次
    if (!spec.data[0]?.values) {
      this.originalData = spec.data;
      this.originalSpec = cloneDeep(spec);
      this.dataSpecs = this.processRankingData(spec as unknown as IRankingListSpec);
      spec.data = this.dataSpecs[0].data;
    }
  }

  transformBaseSpec(spec: any) {
    spec.type = 'common';
    spec.dataKey = DATA_KEY;
    spec.series = [
      {
        type: 'bar',
        direction: 'horizontal',
        xField: spec.xField,
        yField: spec.yField,
        barWidth: spec.bar?.height ?? 10,
        bar: {
          ...spec.bar,
          style: {
            ...spec.bar?.style,
            x1: 0,
            visible: (datum: Datum) => {
              if (datum[SUPPLY_DATA_KEY]) {
                return false;
              }
              return spec.bar?.style ?? true;
            }
          }
        }
      }
    ];
  }

  transformAnimationSpec(spec: any) {
    if (spec.animationUpdate.enable && this.orderCount > 1) {
      spec.player = {
        specs: this.dataSpecs,
        auto: true,
        visible: false,
        interval: (spec.animationNormal?.interval ?? 1000) + (spec.animationUpdate.duration ?? 1000) / 2,
        loop: true,
        ...spec.player
      };

      spec.animationExit = this.getAnimationExit(this.originalSpec);
      spec.animationEnter = this.getAnimationEnter(this.originalSpec);
      spec.animationUpdate = this.getAnimationUpdate(this.originalSpec);
    }
    spec.animationNormal = this.originalSpec.animationNormal;
    spec.animationAppear = this.getAnimationAppear(this.originalSpec, 'rect');
  }

  transformAxesSpec(spec: any) {
    const { min, max } = computeDataRange(this.originalData, spec.xField);
    spec.axes = [
      {
        orient: 'left',
        type: 'band',
        visible: false,
        inverse: true,
        // paddingInner: 0.5,
        paddingOuter: 0.5
      },
      {
        orient: 'bottom',
        label: { visible: true },
        type: 'linear',
        visible: false,
        min,
        max
      }
    ];
  }

  generateBarBackground(spec: any) {
    return {
      type: spec.barBackground.type,
      dataId: 'data',
      visible: true,
      dataKey: DATA_KEY,
      zIndex: -99,
      state: spec.barBackground?.state,
      style: {
        x: (datum: Datum, ctx: any) =>
          spec.barBackground.type === 'symbol' ? ctx.getRegion().getLayoutRect().width / 2 : 0,
        y: (datum: Datum, ctx: any) => {
          return (
            ctx.valueToY([datum[spec.yField]]) +
            ctx.yBandwidth() / 2 -
            (spec.barBackground.type === 'symbol' ? 0 : spec.bar.height / 2)
          );
        },
        size: (datum: Datum, ctx: any) => [ctx.getRegion().getLayoutRect().width, spec.bar.height],
        width: (datum: Datum, ctx: any) => ctx.getRegion().getLayoutRect().width,
        height: spec.bar.height,
        ...spec.barBackground.style,
        visible: (datum: Datum) => {
          if (datum[SUPPLY_DATA_KEY]) {
            return false;
          }
          return spec.barBackground.style.visible;
        }
      },
      animation: true,
      animationEnter: this.getAnimationEnter(this.originalSpec),
      animationExit: this.getAnimationExit(this.originalSpec),
      animationAppear: this.getAnimationAppear(this.originalSpec, 'barBack'),
      animationUpdate: this.getAnimationUpdate(this.originalSpec)
    };
  }

  generateDecorateHaloIcons(spec: any) {
    return spec.decorateHaloIcons?.map((decorateHaloIcon: any) => {
      return {
        type: 'symbol',
        dataId: 'data',
        visible: true,
        dataKey: DATA_KEY,
        state: decorateHaloIcon?.state,
        style: {
          x: (datum: Datum, ctx: any) => {
            if (datum[spec.xField] === undefined || datum[spec.xField] === null) {
              return undefined;
            }
            return ctx.valueToX([datum[spec.xField]]);
          },
          y: (datum: Datum, ctx: any) => {
            return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2;
          },
          ...decorateHaloIcon.style,
          visible: (datum: Datum) => {
            if (datum[SUPPLY_DATA_KEY]) {
              return false;
            }
            return decorateHaloIcon.style.visible;
          }
        },
        animation: true,
        animationEnter: this.getAnimationEnter(this.originalSpec),
        animationExit: this.getAnimationExit(this.originalSpec),
        animationAppear: this.getAnimationAppear(this.originalSpec, 'symbol'),
        animationUpdate: this.getAnimationUpdate(this.originalSpec)
      };
    });
  }

  generateRankingIcon(spec: any) {
    return {
      type: 'symbol',
      dataId: 'data',
      visible: true,
      dataKey: DATA_KEY,
      state: spec.rankingIcon.state,
      style: {
        x: (datum: Datum) => {
          if (spec.labelLayout === 'bothEnd') {
            return -(
              NAME_LABEL_PADDING_RIGHT +
              this.nameLabelTextMeasure.fullMeasure(this.formatDatum(spec.yField, datum)).width +
              (spec.orderLabel.style.visible
                ? NAME_ORDER_PADDING_RIGHT +
                  this.orderLabelTextMeasure.fullMeasure(this.formatDatum(ORDER_KEY, datum)).width
                : 0) +
              NAME_SYMBOL_PADDING_RIGHT
            );
          }
          return CHART_PADDING_LEFT;
        },
        y: (datum: Datum, ctx: any) => {
          if (spec.labelLayout === 'bothEnd') {
            return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2;
          }
          return (
            ctx.valueToY([datum[spec.yField]]) +
            ctx.yBandwidth() / 2 -
            spec.bar.height / 2 -
            LABEL_PADDING_BOTTOM -
            Math.max(
              this.nameLabelTextMeasure.fullMeasure(this.formatDatum(spec.yField, datum)).height,
              this.orderLabelTextMeasure.fullMeasure(this.formatDatum(ORDER_KEY, datum)).height
            ) /
              2
          );
        },
        ...spec.rankingIcon.style,
        lineWidth: 0,
        stroke: null,
        visible: (datum: Datum) => {
          if (datum[SUPPLY_DATA_KEY]) {
            return false;
          }
          return spec.rankingIcon.style.visible;
        }
      },
      animation: true,
      animationEnter: this.getAnimationEnter(this.originalSpec),
      animationExit: this.getAnimationExit(this.originalSpec),
      animationAppear: this.getAnimationAppear(this.originalSpec, 'text'),
      animationUpdate: this.getAnimationUpdate(this.originalSpec)
    };
  }

  generateNameLabel(spec: any) {
    return {
      type: 'text',
      dataId: 'data',
      dataKey: DATA_KEY,
      state: spec.nameLabel?.state,
      style: {
        text: (datum: Datum) => this.formatDatum(spec.yField, datum),
        x: () => {
          if (spec.labelLayout === 'bothEnd') {
            return -NAME_LABEL_PADDING_RIGHT;
          }
          return (
            (spec.rankingIcon.style.visible ? NAME_SYMBOL_PADDING_RIGHT + (spec.rankingIcon.style.size ?? 10) : 0) +
            (spec.orderLabel.style.visible
              ? NAME_ORDER_PADDING_RIGHT + this.getMaxDataLabelLens(spec, ORDER_KEY, this.orderLabelTextMeasure)
              : 0)
          );
        },
        y: (datum: Datum, ctx: any) => {
          if (spec.labelLayout === 'bothEnd') {
            return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2;
          }
          return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2 - spec.bar.height / 2 - LABEL_PADDING_BOTTOM;
        },
        ...spec.nameLabel.style,
        textAlign: spec.labelLayout === 'bothEnd' ? 'right' : 'left',
        textBaseline: spec.labelLayout === 'bothEnd' ? 'middle' : 'bottom',
        visible: (datum: Datum) => {
          if (datum[SUPPLY_DATA_KEY]) {
            return false;
          }
          return spec.nameLabel.style.visible;
        }
      },
      animation: true,
      animationEnter: this.getAnimationEnter(this.originalSpec),
      animationExit: this.getAnimationExit(this.originalSpec),
      animationAppear: this.getAnimationAppear(this.originalSpec, 'text'),
      animationUpdate: this.getAnimationUpdate(this.originalSpec)
    };
  }

  generateOrderLabel(spec: any) {
    return {
      type: 'text',
      dataId: 'data',
      dataKey: DATA_KEY,
      state: spec.orderLabel?.state,
      style: {
        text: (datum: Datum) => this.formatDatum(ORDER_KEY, datum),
        x: (datum: Datum) => {
          if (spec.labelLayout === 'bothEnd') {
            return -(
              NAME_LABEL_PADDING_RIGHT +
              this.nameLabelTextMeasure.fullMeasure(this.formatDatum(spec.yField, datum)).width +
              NAME_ORDER_PADDING_RIGHT
            );
          }
          return spec.rankingIcon.style.visible ? NAME_SYMBOL_PADDING_RIGHT + (spec.rankingIcon.style.size ?? 10) : 0;
        },
        y: (datum: Datum, ctx: any) => {
          if (spec.labelLayout === 'bothEnd') {
            return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2;
          }
          return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2 - spec.bar.height / 2 - LABEL_PADDING_BOTTOM;
        },
        ...spec.orderLabel.style,
        textAlign: spec.labelLayout === 'bothEnd' ? 'right' : 'left',
        textBaseline: spec.labelLayout === 'bothEnd' ? 'middle' : 'bottom',
        visible: (datum: Datum) => {
          if (datum[SUPPLY_DATA_KEY]) {
            return false;
          }
          return spec.orderLabel.style.visible;
        }
      },
      animation: true,
      animationEnter: this.getAnimationEnter(this.originalSpec),
      animationExit: this.getAnimationExit(this.originalSpec),
      animationAppear: this.getAnimationAppear(this.originalSpec, 'text'),
      animationUpdate: this.getAnimationUpdate(this.originalSpec)
    };
  }

  generateValueLabel(spec: any) {
    return {
      type: 'text',
      dataId: 'data',
      visible: true,
      dataKey: DATA_KEY,
      state: spec.valueLabel?.state,
      style: {
        text: (datum: Datum) => this.formatDatum(spec.xField, datum),
        x: (datum: Datum, ctx: any) => {
          if (spec.labelLayout === 'bothEnd') {
            return (
              ctx.getRegion().getLayoutRect().width +
              // this.getMaxDataLabelLens(spec, spec.xField, this.valueLabelTextMeasure) +
              VALUE_LABEL_PADDING_LEFT
            );
          }
          return ctx.getRegion().getLayoutRect().width;
        },
        y: (datum: Datum, ctx: any) => {
          if (spec.labelLayout === 'bothEnd') {
            return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2;
          }
          return ctx.valueToY([datum[spec.yField]]) + ctx.yBandwidth() / 2 - spec.bar.height / 2 - LABEL_PADDING_BOTTOM;
        },
        ...spec.valueLabel.style,
        textAlign: spec.labelLayout === 'bothEnd' ? 'left' : 'right',
        textBaseline: spec.labelLayout === 'bothEnd' ? 'middle' : 'bottom',
        visible: (datum: Datum) => {
          if (datum[SUPPLY_DATA_KEY]) {
            return false;
          }
          return spec.valueLabel.style.visible;
        }
      },
      animation: true,
      animationEnter: this.getAnimationEnter(this.originalSpec),
      animationExit: this.getAnimationExit(this.originalSpec),
      animationAppear: this.getAnimationAppear(this.originalSpec, 'text'),
      animationUpdate: this.getAnimationUpdate(this.originalSpec)
    };
  }

  transformPaddingSpec(spec: any) {
    const maxHaloIconSize =
      spec.decorateHaloIcons.length > 0
        ? Math.max(...spec.decorateHaloIcons.map((icon: any) => icon.style?.size ?? 18))
        : 0;
    spec.padding = {
      left:
        spec.labelLayout === 'bothEnd'
          ? NAME_LABEL_PADDING_RIGHT +
            this.getMaxDataLabelLens(spec, spec.yField, this.nameLabelTextMeasure) +
            (spec.orderLabel.style.visible
              ? NAME_ORDER_PADDING_RIGHT + this.getMaxDataLabelLens(spec, ORDER_KEY, this.orderLabelTextMeasure)
              : 0) +
            (spec.rankingIcon.style.visible ? NAME_SYMBOL_PADDING_RIGHT + (spec.rankingIcon.style.size ?? 10) : 0) +
            CHART_PADDING_LEFT
          : CHART_PADDING_LEFT + maxHaloIconSize / 2,
      right:
        spec.labelLayout === 'bothEnd'
          ? VALUE_LABEL_PADDING_LEFT +
            this.getMaxDataLabelLens(spec, spec.xField, this.valueLabelTextMeasure) +
            CHART_PADDING_RIGHT
          : CHART_PADDING_RIGHT + 10,
      top: 0,
      bottom: 0,
      ...spec.padding
    };
  }

  paginateDataArr = (spec: IRankingListSpec) => {
    const { scrollSize = 1, pageSize = 5 } = spec;
    const arr = this.originalData;
    const result: { [key: string]: Datum[] } = {};
    let pageOrder = 0;
    for (let i = 0; i < arr.length; i += scrollSize) {
      pageOrder++;
      result[`page${pageOrder}`] = arr.slice(i, i + pageSize);
      if (i + pageSize - 1 >= arr.length - 1) {
        arr.push(
          ...Array.from({ length: i + pageSize - arr.length }, _ => {
            return {
              [spec.yField]: Math.random() * 100,
              [spec.xField]: null,
              [SUPPLY_DATA_KEY]: true
            };
          })
        );
        break;
      }
    }
    return {
      orderCount: pageOrder,
      result: result
    };
  };

  processRankingData = (spec: IRankingListSpec) => {
    const result: any[] = [];
    spec.data.forEach((datum, index) => (datum[ORDER_KEY] = index + 1 < 10 ? `0${index + 1}` : index + 1));
    const pagerData = this.paginateDataArr(spec).result;
    const orderCount = this.paginateDataArr(spec).orderCount;
    this.orderCount = orderCount;
    const supplyCount = spec.pageSize - pagerData[`page${orderCount}`].length;
    pagerData[`page${orderCount}`].push(
      ...Array.from({ length: supplyCount }, (_: any) => {
        return {
          [spec.yField]: Math.random() * 100,
          [spec.xField]: null,
          [SUPPLY_DATA_KEY]: true
        };
      })
    );

    Object.keys(pagerData).forEach(order => {
      result.push({
        data: [
          {
            id: 'datas',
            values: pagerData[order].map(d => {
              return { ...d, [DATA_KEY]: d[spec.yField] };
            })
          },
          {
            id: 'order',
            values: [
              {
                order
              }
            ]
          }
        ]
      });
    });

    // // 只有1页时, player循环播放时, prePage和curPage data一致, 导致没有动画效果
    // // 在此手动复制1页, 且prePage和curPage dataKey不一致, 保证动画效果
    // if (result.length === 1) {
    //   result.push({
    //     data: [
    //       {
    //         id: 'datas',
    //         values: pagerData['page1'].map(d => {
    //           return { ...d, [DATA_KEY]: 'page2_' + d['y'] };
    //         })
    //       },
    //       {
    //         id: 'order',
    //         values: [
    //           {
    //             order: 'page2'
    //           }
    //         ]
    //       }
    //     ]
    //   });
    // }

    return result;
  };

  getMaxDataLabelLens(spec: IRankingListSpec, field: string, textMeasure: TextMeasure<any>) {
    const textWidths = this.originalData.map(datum =>
      datum[SUPPLY_DATA_KEY] ? 0 : textMeasure.fullMeasure(this.formatDatum(field, datum)).width
    );
    return Math.max(...textWidths);
  }

  formatDatum(field: string, datum: Datum) {
    if (this.formatMap?.[field]) {
      return this.formatMap[field](datum[field], datum);
    }
    return datum[field];
  }

  getLabelWidth(padding: number, width: number) {
    return width + padding;
  }

  getAnimationExit(spec: IRankingListSpec) {
    if (spec.animationUpdate?.enable === false) {
      return false;
    }
    return {
      type: 'moveOut',
      options: {
        direction: 'y',

        orient: 'negative',
        excludeChannels: ['x'],
        point: (datum: Datum, graphic: IMarkGraphic) => {
          const channelAttr = graphic.getGraphicAttribute('y');
          const barSpace = spec.height / (spec.pageSize + 1);
          return { y: channelAttr - barSpace * Math.min(spec.scrollSize, spec.pageSize) };
        }
      },
      duration: spec.animationUpdate?.duration ?? 1000,
      easing: spec.animationUpdate?.easing ?? 'linear'
    };
  }

  getAnimationEnter(spec: IRankingListSpec) {
    if (spec.animationUpdate?.enable === false) {
      return false;
    }
    return {
      type: 'moveIn',
      options: {
        direction: 'y',
        orient: 'negative',
        excludeChannels: ['x'],
        point: (datum: Datum, graphic: IMarkGraphic) => {
          const channelAttr = graphic.getGraphicAttribute('y');
          return { y: channelAttr + (spec.height / (spec.pageSize + 1)) * Math.min(spec.scrollSize, spec.pageSize) };
        }
      },
      duration: spec.animationUpdate?.duration ?? 1000,
      easing: spec.animationUpdate?.easing ?? 'linear'
    };
  }

  getAnimationAppear(spec: IRankingListSpec, markType: 'rect' | 'text' | 'symbol' | 'barBack') {
    if (spec.animationAppear?.enable === false) {
      return false;
    }
    if (markType === 'rect') {
      return {
        type: 'growWidthIn',
        oneByOne: false,
        duration: spec.animationAppear?.duration ?? 1000,
        easing: spec.animationAppear?.easing ?? 'linear',
        options: {}
      };
    } else if (markType === 'symbol') {
      return {
        channel: {
          x: {
            from: 0,
            to: (datum: Datum, graphic: IMarkGraphic) => {
              return graphic.getGraphicAttribute('x');
            }
          }
        },
        duration: spec.animationAppear?.duration ?? 1000,
        easing: spec.animationAppear?.easing ?? 'linear'
      };
    }
    return {
      channel: {
        opacity: {
          from: 0,
          to: 1
        }
      },
      duration: spec.animationAppear?.duration ?? 1000,
      easing: spec.animationAppear?.easing ?? 'linear'
    };
  }

  getAnimationUpdate(spec: IRankingListSpec) {
    if (spec.animationUpdate.enable === false) {
      return false;
    }
    return {
      duration: spec.animationUpdate?.duration ?? 1000,
      easing: spec.animationUpdate?.easing ?? 'linear'
    };
  }
}
