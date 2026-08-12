import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
// eslint-disable-next-line no-duplicate-imports
import { isValid, max } from '@visactor/vutils';
import type { Datum, ILiquidMarkSpec, IPoint } from '../../typings';
import { animationConfig, userAnimationConfig } from '../../animation/utils';
import type { ILiquidPadding, ILiquidSeriesSpec, LiquidAppearPreset, LiquidShapeType } from './interface';
import type { IStateAnimateSpec } from '../../animation/spec';
// eslint-disable-next-line no-duplicate-imports
import { registerLiquidAnimation } from './animation';
import { LiquidSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import type { IGroupMark, IMark, IMarkRaw } from '../../mark/interface';
import { LineLikeSeriesSpecTransformer } from '../mixin/line-mixin-transformer';
import { registerLiquidMark } from '../../mark/liquid';
import { AttributeLevel } from '../../constant/attribute';
import { ChartEvent } from '../../constant/event';
import { BaseSeries } from '../base';
// eslint-disable-next-line no-duplicate-imports
import { registerGroupMark } from '../../mark/group';
import { getShapes } from './util';
import { createRect, createSymbol } from '@visactor/vrender-core';
import type { IColor, IGlyph } from '@visactor/vrender-core';
import { labelSmartInvert } from '@visactor/vrender-components';
import { normalizeLayoutPaddingSpec } from '../../util';
import type { DataView } from '@visactor/vdataset';
import { LiquidSeriesTooltipHelper } from './tooltip-helper';
import { liquid } from '../../theme/builtin/common/series/liquid';

export type ILiquidMark = IMarkRaw<ILiquidMarkSpec>;
export class LiquidSeries<T extends ILiquidSeriesSpec = ILiquidSeriesSpec> extends BaseSeries<T> {
  static readonly type: string = SeriesTypeEnum.liquid;
  type = SeriesTypeEnum.liquid;

  static readonly mark: SeriesMarkMap = LiquidSeriesMark;
  static readonly builtInTheme = { liquid };
  static readonly transformerConstructor = LineLikeSeriesSpecTransformer;
  readonly transformerConstructor = LineLikeSeriesSpecTransformer;
  private _liquidGroupMark?: IGroupMark;
  private _liquidMark?: ILiquidMark;
  private _liquidBackgroundMark?: IGroupMark | null = null;
  private _liquidOutlineMark?: IGroupMark | null = null;
  private _paddingSpec?: ILiquidPadding;
  private _marginSpec?: ILiquidPadding;

  private _heightRatio?: number;

  private _reverse?: boolean;
  private _maskShape?: LiquidShapeType;

  protected _valueField?: string;
  setValueField(field: string) {
    if (isValid(field)) {
      this._valueField = field;
    }
  }
  getValueField() {
    return this._valueField;
  }

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this._marginSpec = normalizeLayoutPaddingSpec(this._spec.outlineMargin) as ILiquidPadding;
    this._paddingSpec = normalizeLayoutPaddingSpec(this._spec.outlinePadding) as ILiquidPadding;
    this.setValueField(this._spec.valueField);
    this._reverse = this._spec.reverse ?? false;
    this._maskShape = this._spec.maskShape ?? 'circle';
  }

  viewDataUpdate(d: DataView): void {
    super.viewDataUpdate(d);
    this._heightRatio = max(...this._data.getLatestData().map((d: Datum) => d[this._valueField]));
  }

  initMark(): void {
    this._initLiquidOutlineMark();
    this._initLiquidBackgroundMark();
    this._initLiquidMark();
  }

  initMarkStyle(): void {
    this._initLiquidOutlineMarkStyle();
    this._initLiquidBackgroundMarkStyle();
    this._initLiquidMarkStyle();
  }

  private _initLiquidOutlineMark() {
    this._liquidOutlineMark = this._createMark(LiquidSeries.mark.liquidOutline, {
      isSeriesMark: true,
      skipBeforeLayouted: false
    }) as IGroupMark;
    return this._liquidOutlineMark;
  }

  private _initLiquidBackgroundMark() {
    this._liquidBackgroundMark = this._createMark(LiquidSeries.mark.liquidBackground, {
      isSeriesMark: true,
      skipBeforeLayouted: false
    }) as IGroupMark;
    return this._liquidBackgroundMark;
  }

  private _initLiquidMark() {
    this._liquidGroupMark = this._createMark(LiquidSeries.mark.liquidGroup, {
      parent: this._liquidBackgroundMark,
      isSeriesMark: true,
      skipBeforeLayouted: false
    }) as IGroupMark;
    this._liquidMark = this._createMark(LiquidSeries.mark.liquid, {
      parent: this._liquidGroupMark,
      isSeriesMark: true,
      skipBeforeLayouted: false
    }) as ILiquidMark;
    return this._liquidMark;
  }

  protected _buildMarkAttributeContext() {
    super._buildMarkAttributeContext();
    this._markAttributeContext.getLiquidBackPosAndSize = this._getLiquidBackPosAndSize;
    this._markAttributeContext.getLiquidPosY = this._getLiquidPosY;
    this._markAttributeContext.getLiquidHeight = this._getLiquidHeight;
  }

  private _getLiquidPosY = () => {
    let liquidY = 0;
    const { height: liquidBackHeight, startY } = this._getLiquidBackPosAndSize();
    if (this._reverse) {
      liquidY = liquidBackHeight * this._heightRatio;
    } else {
      liquidY = liquidBackHeight * (1 - this._heightRatio);
    }
    return liquidY + startY;
  };

  private _getLiquidHeight = () => {
    const { height: liquidBackHeight } = this._getLiquidBackPosAndSize();
    return liquidBackHeight * this._heightRatio;
  };

  private _getLiquidBackPosAndSize = (isOutline: boolean = false) => {
    let {
      top: marginTop = 0,
      bottom: marginBottom = 0,
      // eslint-disable-next-line prefer-const
      left: marginLeft = 0,
      // eslint-disable-next-line prefer-const
      right: marginRight = 0
    } = this._marginSpec;
    let {
      top: paddingTop = 0,
      bottom: paddingBottom = 0,
      // eslint-disable-next-line prefer-const
      left: paddingLeft = 0,
      // eslint-disable-next-line prefer-const
      right: paddingRight = 0
    } = isOutline ? {} : this._paddingSpec;

    // 纠偏：对于正三角形而言, 上下留取相同的padidng/margin, 视觉上会看到下面留取的空白大于上面
    // 正确的做法是保持正三角形在60度方向上空白一致，换算到bottom就是/Math.sqrt(3), 换算到top就是 value/Math.sqrt(3)*2
    if (this._maskShape === 'triangle') {
      marginBottom = marginBottom / Math.sqrt(3);
      marginTop = (marginTop / Math.sqrt(3)) * 2;
      paddingBottom = paddingBottom / Math.sqrt(3);
      paddingTop = (paddingTop / Math.sqrt(3)) * 2;
    }

    const { width: regionWidth, height: regionHeight } = this._region?.getLayoutRect() ?? { width: 0, height: 0 };

    const deltaX = (marginLeft + paddingLeft - (marginRight + paddingRight)) / 2;
    const deltaY = (marginTop + paddingTop - (marginBottom + paddingBottom)) / 2;
    const x = regionWidth / 2 + deltaX;
    const y = regionHeight / 2 + deltaY;

    // 用于rect mark style
    let width = regionWidth - (marginLeft + marginRight + paddingLeft + paddingRight);
    let height = regionHeight - (marginTop + marginBottom + paddingTop + paddingBottom);
    // console.log('regionWidth', regionWidth, regionHeight)

    // 用于symbol mark style
    const size = Math.min(width, height);
    if (this._maskShape !== 'rect') {
      width = size;
      height = size;
    }

    return {
      x,
      y,
      size,
      width,
      height,
      startX: x - width / 2,
      startY: y - height / 2,
      endX: x + width / 2,
      endY: y + height / 2
    };
  };

  private _getLiquidBackPath = (isOutline: boolean = false) => {
    let symbolPath;
    if (this._maskShape === 'rect') {
      const { x, y, width, height } = this._getLiquidBackPosAndSize(isOutline);
      symbolPath = createRect({
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        fill: true
      });
    } else {
      const { x, y, size } = this._getLiquidBackPosAndSize(isOutline);
      // console.log('size', size)
      symbolPath = createSymbol({
        x,
        y,
        size,
        symbolType: getShapes(this._spec.maskShape ?? 'circle', size),
        fill: true
      });
    }
    return [symbolPath];
  };

  private _initLiquidOutlineMarkStyle() {
    const liquidOutlineMark = this._liquidOutlineMark;
    liquidOutlineMark.created();
    this.setMarkStyle(
      liquidOutlineMark,
      {
        stroke: this.getColorAttribute(),
        width: () => this._region.getLayoutRect().width,
        height: () => this._region.getLayoutRect().height,
        path: () => this._getLiquidBackPath(true)
      },
      'normal',
      AttributeLevel.Series
    );
    this._liquidOutlineMark.setMarkConfig({ interactive: false, zIndex: this.layoutZIndex });
  }

  private _initLiquidBackgroundMarkStyle() {
    const liquidBackgroundMark = this._liquidBackgroundMark;
    liquidBackgroundMark.created();
    // symbol mark x, y 指定center
    // rect mark x,y 指定左上角
    this.setMarkStyle(
      liquidBackgroundMark,
      {
        width: () => this._region.getLayoutRect().width,
        height: () => this._region.getLayoutRect().height,
        path: () => this._getLiquidBackPath()
      },
      'normal',
      AttributeLevel.Series
    );
    this._liquidBackgroundMark.setMarkConfig({ interactive: false, zIndex: this.layoutZIndex, clip: true });
  }

  private _initLiquidMarkStyle() {
    const liquidMark = this._liquidMark;
    const liquidGroupMark = this._liquidGroupMark;
    if (liquidGroupMark) {
      this.setMarkStyle(liquidGroupMark, {
        x: () => {
          return this._region.getLayoutStartPoint().x + this._region.getLayoutRect().width / 2;
        },
        angle: this._reverse ? -Math.PI : 0,
        y: 0,
        dy: this._getLiquidPosY
      });
    }
    if (liquidMark) {
      // liquid mark x, y 指定左上角
      this.setMarkStyle(
        liquidMark,
        {
          // wave图元设置y后, 3个子area图元的point发生变化, 但vrender的渐变区域没有变化, 待vrender修复
          // 目前先采用下列方法配置:
          // 1. y强制指定为0, 保证图元不超出vrender的渐变区域
          // 2. 在外面包一层group图元, 使用group dy做偏移, 保证vrender渐变区域随图元位置变化而更新
          y: 0,
          dy: 0,
          height: this._getLiquidHeight,
          fill: this.getColorAttribute(),
          wave: 0
        },
        'normal',
        AttributeLevel.Series
      );
    }
  }

  protected initTooltip() {
    this._tooltipHelper = new LiquidSeriesTooltipHelper(this);
    this._liquidMark && this._tooltipHelper.activeTriggerSet.mark.add(this._liquidMark);
  }

  getInteractionTriggers() {
    return this._parseInteractionConfig(this._liquidMark ? [this._liquidMark] : []);
  }

  initAnimation() {
    const animationParams = {
      height: {
        from: 0,
        to: () => {
          return this._getLiquidHeight();
        }
      },
      dy: {
        from: () => {
          let liquidY = 0;
          const { height: liquidBackHeight, startY } = this._getLiquidBackPosAndSize();
          if (this._reverse) {
            liquidY = 0;
          } else {
            liquidY = liquidBackHeight;
          }
          return liquidY + startY;
        }
      }
    };
    const appearPreset = (this._spec?.animationAppear as IStateAnimateSpec<LiquidAppearPreset>)?.preset;
    this._liquidMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('liquid')?.(animationParams, appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.liquid, this._spec, this._markAttributeContext)
      )
    );
    this._liquidGroupMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('liquidGroup')?.(animationParams, appearPreset),
        userAnimationConfig(SeriesMarkNameEnum.liquidGroup, this._spec, this._markAttributeContext)
      )
    );
  }

  protected initEvent(): void {
    super.initEvent();
    if (!this._spec.indicatorSmartInvert || !this._option.getChart().getComponentsByKey('indicator')) {
      return;
    }
    this.event.on(ChartEvent.renderFinished, () => {
      this._option
        .getChart()
        .getComponentsByKey('indicator')
        .forEach((indicatorComponent: any) => {
          // wave item比较特殊,  由wave1、wave2、wave3在x方向上偏移叠加而成
          // 由于在水波图中只需要判断y方向上是否重叠, 所以此处取wave1做y方向上对比
          const waveItem = (this._liquidMark.getGraphics()[0] as unknown as IGlyph).getSubGraphic()?.[0];
          let { y1: waveY1, y2: waveY2 } = waveItem.globalAABBBounds;
          waveY1 += this._region.getLayoutStartPoint().y;
          waveY2 += this._region.getLayoutStartPoint().y;
          indicatorComponent
            ?.getIndicatorComponent()
            ?.getChildren()[0]
            ?.getChildren()
            .forEach((text: any) => {
              const { y1: textY1, y2: textY2 } = text.globalAABBBounds;
              if (waveY1 < textY1 && waveY2 > textY2) {
                const foregroundColor = text.attribute.fill;
                const backgroundColor = waveItem.attribute.fill;
                const invertColor = labelSmartInvert(foregroundColor, backgroundColor as IColor);
                text.setAttribute('fill', invertColor);
              }
            });
        });
    });
  }

  dataToPosition(data: Datum): IPoint {
    return null;
  }
  dataToPositionX(data: Datum): number {
    return null;
  }
  dataToPositionY(data: Datum): number {
    return null;
  }
  valueToPosition(value1: any, value2?: any): IPoint {
    return null;
  }

  getStatisticFields(): any[] {
    return [];
  }

  getGroupFields(): string[] {
    return [];
  }
  getStackGroupFields(): string[] {
    return [];
  }
  getStackValueField(): string {
    return '';
  }

  getActiveMarks(): IMark[] {
    return [this._liquidMark];
  }
}

export const registerLiquidSeries = () => {
  registerLiquidMark();
  registerGroupMark();
  registerLiquidAnimation();
  Factory.registerSeries(LiquidSeries.type, LiquidSeries);
};
