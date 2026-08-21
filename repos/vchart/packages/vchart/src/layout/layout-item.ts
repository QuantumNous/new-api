import type { ILayoutModel } from './../model/interface';
import type { IPadding, IRect, IPoint } from '../typings';
import type { IBoundsLike } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isNil, isValidNumber } from '@visactor/vutils';
import { calcLayoutNumber, calcPadding, normalizeLayoutPaddingSpec, boundsInRect } from '../util/space';
import { LayoutLevel, DEFAULT_LAYOUT_RECT_LEVEL, USER_LAYOUT_RECT_LEVEL } from '../constant/layout';

import type { ILayoutItem, ILayoutItemInitOption, ILayoutItemSpec } from './interface';
import type { IChartLayoutOption } from '../chart/interface/common';
import type { ILayoutAlignSelf, ILayoutPoint, ILayoutRect } from '../typings/layout';

export class LayoutItem implements ILayoutItem {
  protected _spec: ILayoutItemSpec;
  getSpec() {
    return this._spec || {};
  }

  layoutClip: boolean = false;

  autoIndent: boolean = false;

  private _layoutStartPoint: ILayoutPoint = {
    x: 0,
    y: 0
  };

  getLayoutStartPoint(): ILayoutPoint {
    return this._layoutStartPoint;
  }

  private _layoutRect: ILayoutRect = { width: 0, height: 0 };

  // 处理用户和逻辑的优先级覆盖，让用户也可以设置 rect
  protected _layoutRectLevelMap: ILayoutRect = {
    width: DEFAULT_LAYOUT_RECT_LEVEL,
    height: DEFAULT_LAYOUT_RECT_LEVEL
  };
  get layoutRectLevelMap() {
    return this._layoutRectLevelMap;
  }

  protected _minWidth: number = null;
  get minWidth() {
    return this._minWidth;
  }
  set minWidth(v: number) {
    this._minWidth = v;
  }
  protected _maxWidth: number = null;
  get maxWidth() {
    return this._maxWidth;
  }
  set maxWidth(v: number) {
    this._maxWidth = v;
  }
  protected _minHeight: number = null;
  get minHeight() {
    return this._minHeight;
  }
  set minHeight(v: number) {
    this._minHeight = v;
  }
  protected _maxHeight: number = null;
  get maxHeight() {
    return this._maxHeight;
  }
  set maxHeight(v: number) {
    this._maxHeight = v;
  }
  /** for layout diff */
  protected _lastComputeRect: ILayoutRect = null;
  get lastComputeRect() {
    return this._lastComputeRect;
  }
  protected _lastComputeOutBounds: IBoundsLike = { x1: 0, x2: 0, y1: 0, y2: 0 };
  getLastComputeOutBounds(): IBoundsLike {
    return this._lastComputeOutBounds;
  }

  getLayoutRect: () => ILayoutRect = () => {
    return this._layoutRect;
  };

  layoutType: ILayoutItem['layoutType'] = 'normal';

  layoutBindRegionID!: ILayoutItem['layoutBindRegionID'];

  _layoutOrient: ILayoutItem['layoutOrient'] = 'left';
  get layoutOrient() {
    return this._layoutOrient;
  }
  set layoutOrient(v: ILayoutItem['layoutOrient']) {
    this._layoutOrient = v;
  }
  layoutPaddingLeft: ILayoutItem['layoutPaddingLeft'] = 0;
  layoutPaddingTop: ILayoutItem['layoutPaddingTop'] = 0;
  layoutPaddingRight: ILayoutItem['layoutPaddingRight'] = 0;
  layoutPaddingBottom: ILayoutItem['layoutPaddingBottom'] = 0;

  layoutOffsetX: ILayoutItem['layoutOffsetX'] = 0;
  layoutOffsetY: ILayoutItem['layoutOffsetY'] = 0;

  layoutLevel: ILayoutItem['layoutLevel'] = LayoutLevel.Region;

  chartLayoutRect!: ILayoutRect;

  alignSelf: ILayoutAlignSelf;

  protected _model: ILayoutModel;

  get model() {
    return this._model;
  }

  get type() {
    return this._model.type;
  }

  protected _option: ILayoutItemInitOption;

  protected _willLayoutTag: boolean = true;
  get willLayoutTag() {
    return this._willLayoutTag;
  }

  constructor(model: ILayoutModel, option: ILayoutItemInitOption) {
    this._model = model;
    this._option = option;
    this.layoutLevel = option.layoutLevel;
    this.layoutType = option.layoutType;
    if (option.layoutOrient) {
      this.layoutOrient = option.layoutOrient;
    }
    this._spec = model?.getSpec?.();
  }

  private _setLayoutAttributeFromSpec(spec: ILayoutItemSpec, chartViewRect: ILayoutRect) {
    if (!this._spec) {
      return;
    }
    if ((this._spec as unknown as any).visible !== false) {
      // 处理 user spec value to px;
      // 先计算出 padding
      const padding = normalizeLayoutPaddingSpec(spec.padding);
      let paddingValue = calcPadding(padding, chartViewRect, chartViewRect);
      if (this._option.transformLayoutPadding) {
        paddingValue = this._option.transformLayoutPadding(paddingValue);
      }
      this.layoutPaddingLeft = paddingValue.left;
      this.layoutPaddingRight = paddingValue.right;
      this.layoutPaddingTop = paddingValue.top;
      this.layoutPaddingBottom = paddingValue.bottom;

      this._minHeight = isNil(spec.minHeight)
        ? this._minHeight ?? null
        : calcLayoutNumber(spec.minHeight, chartViewRect.height, chartViewRect);
      this._maxHeight = isNil(spec.maxHeight)
        ? this._maxHeight ?? null
        : calcLayoutNumber(spec.maxHeight, chartViewRect.height, chartViewRect);
      this._minWidth = isNil(spec.minWidth)
        ? this._minWidth ?? null
        : calcLayoutNumber(spec.minWidth, chartViewRect.width, chartViewRect);
      this._maxWidth = isNil(spec.maxWidth)
        ? this._maxWidth ?? null
        : calcLayoutNumber(spec.maxWidth, chartViewRect.width, chartViewRect);
      // 处理 user width
      if (spec.width) {
        this.setLayoutRect(
          {
            width: calcLayoutNumber(spec.width, chartViewRect.width, chartViewRect)
          },
          {
            width: USER_LAYOUT_RECT_LEVEL
          }
        );
      }
      if (spec.height) {
        this.setLayoutRect(
          {
            height: calcLayoutNumber(spec.height, chartViewRect.height, chartViewRect)
          },
          {
            height: USER_LAYOUT_RECT_LEVEL
          }
        );
      }

      // offset
      if (!isNil(spec.offsetX)) {
        this.layoutOffsetX = calcLayoutNumber(spec.offsetX, chartViewRect.width, chartViewRect);
      }
      if (!isNil(spec.offsetY)) {
        this.layoutOffsetY = calcLayoutNumber(spec.offsetY, chartViewRect.height, chartViewRect);
      }

      if (spec.alignSelf) {
        this.alignSelf = spec.alignSelf;
      }
    }
  }

  setAttrFromSpec(spec: ILayoutItemSpec, chartViewRect: ILayoutRect) {
    this._spec = spec;
    this.layoutType = spec.layoutType ?? this.layoutType;
    this.layoutLevel = spec.layoutLevel ?? this.layoutLevel;
    this.layoutOrient = spec.orient ?? this.layoutOrient;

    this._setLayoutAttributeFromSpec(spec, chartViewRect);

    this.layoutClip = spec.clip ?? this.layoutClip;
  }

  onLayoutStart(layoutRect: IRect, viewRect: ILayoutRect) {
    // 在 layoutStart 时重新计算 spec 中的布局属性值，确保 resize 后，这些值保持正确的px值。
    this._setLayoutAttributeFromSpec(this._spec, viewRect);
  }

  onLayoutEnd() {
    // do nothing
  }

  private _getAbsoluteSpecValue(layoutRect: ILayoutRect) {
    const result: IPadding = { top: null, bottom: null, left: null, right: null };
    ['top', 'bottom', 'left', 'right'].forEach(k => {
      if (!isNil(this._spec[k])) {
        result[k] = calcLayoutNumber(
          this._spec[k],
          k === 'top' || k === 'bottom' ? layoutRect.height : layoutRect.width,
          layoutRect
        );
      }
    });
    return result;
  }

  absoluteLayoutInRect(layoutRect: IRect) {
    const { top, bottom, left, right } = this._getAbsoluteSpecValue(layoutRect);

    // size first
    const layoutSize = {
      width: layoutRect.width - this.layoutPaddingLeft - this.layoutPaddingRight,
      height: layoutRect.height - this.layoutPaddingTop - this.layoutPaddingBottom
    };
    if (!isNil(left)) {
      layoutSize.width -= left;
    }
    if (!isNil(right)) {
      layoutSize.width -= right;
    }
    if (!isNil(top)) {
      layoutSize.height -= top;
    }
    if (!isNil(bottom)) {
      layoutSize.height -= bottom;
    }

    this.setLayoutRect(layoutSize);
    const { width, height } = this.computeBoundsInRect(this.getLayoutRect());
    this.setLayoutRect({ width, height });
    const pos = { x: layoutRect.x, y: layoutRect.y };
    if (this._spec.center === true) {
      pos.x = layoutRect.x + layoutRect.width * 0.5 - width * 0.5;
      pos.y = layoutRect.y + layoutRect.height * 0.5 - height * 0.5;
    } else {
      if (!isNil(left)) {
        pos.x = layoutRect.x + left + this.layoutPaddingLeft;
      } else if (!isNil(right)) {
        pos.x = layoutRect.x + layoutRect.width - this.layoutPaddingRight - right - width;
      }
      if (!isNil(top)) {
        pos.y = layoutRect.y + top + this.layoutPaddingTop;
      } else if (!isNil(bottom)) {
        pos.y = layoutRect.y + layoutRect.height - this.layoutPaddingBottom - bottom - height;
      }
    }

    this.setLayoutStartPosition(pos);
  }

  setLayoutStartPosition(pos: Partial<IPoint>): void {
    if (this._option.transformLayoutPosition) {
      pos = this._option.transformLayoutPosition(pos);
    }
    if (isValidNumber(pos.x)) {
      this._layoutStartPoint.x = pos.x;
    }
    if (isValidNumber(pos.y)) {
      this._layoutStartPoint.y = pos.y;
    }

    this._model.afterSetLayoutStartPoint?.(this._layoutStartPoint);
  }

  setLayoutRect({ width, height }: Partial<ILayoutRect>, levelMap?: Partial<ILayoutRect>) {
    if (isValidNumber(width) && (levelMap?.width ?? DEFAULT_LAYOUT_RECT_LEVEL) >= this._layoutRectLevelMap.width) {
      this._layoutRect.width = width;
      this._layoutRectLevelMap.width = levelMap?.width ?? DEFAULT_LAYOUT_RECT_LEVEL;
    }

    if (isValidNumber(height) && (levelMap?.height ?? DEFAULT_LAYOUT_RECT_LEVEL) >= this._layoutRectLevelMap.height) {
      this._layoutRect.height = height;
      this._layoutRectLevelMap.height = levelMap?.height ?? DEFAULT_LAYOUT_RECT_LEVEL;
    }

    this.setRectInSpec(this._layoutRect);
  }

  getLayout(): IRect {
    return {
      x: this._layoutStartPoint.x,
      y: this._layoutStartPoint.y,
      width: this._layoutRect.width,
      height: this._layoutRect.height
    };
  }

  mergeLayoutRect({ width, height }: ILayoutRect): ILayoutRect {
    const rect = { width, height };
    if (this._layoutRectLevelMap.width > DEFAULT_LAYOUT_RECT_LEVEL) {
      rect.width = this._layoutRect.width;
    }
    if (this._layoutRectLevelMap.height > DEFAULT_LAYOUT_RECT_LEVEL) {
      rect.height = this._layoutRect.height;
    }
    return rect;
  }

  getOrientPosAttribute() {
    return this._layoutOrient === 'bottom' || this._layoutOrient === 'top' ? 'x' : 'y';
  }
  getOrientSizeAttribute() {
    return this._layoutOrient === 'bottom' || this._layoutOrient === 'top' ? 'width' : 'height';
  }

  protected changeBoundsBySetting(bounds: IBoundsLike): IBoundsLike {
    // 用户设置了布局元素宽高的场景下，内部布局结果的 bounds 不能直接作为图表布局bounds
    if (this._layoutRectLevelMap.width > DEFAULT_LAYOUT_RECT_LEVEL) {
      bounds.x2 = bounds.x1 + this._layoutRect.width;
    }
    if (this._layoutRectLevelMap.height > DEFAULT_LAYOUT_RECT_LEVEL) {
      bounds.y2 = bounds.y1 + this._layoutRect.height;
    }
    bounds.x1 -= this._layoutStartPoint.x;
    bounds.x2 -= this._layoutStartPoint.x;
    bounds.y1 -= this._layoutStartPoint.y;
    bounds.y2 -= this._layoutStartPoint.y;
    return bounds;
  }

  setRectInSpec(rect: ILayoutRect) {
    const result = { ...rect };
    if (this._layoutRectLevelMap.width < USER_LAYOUT_RECT_LEVEL) {
      if (!isNil(this._minWidth)) {
        result.width = Math.max(result.width, this._minWidth);
      }
      if (!isNil(this._maxWidth)) {
        result.width = Math.min(result.width, this._maxWidth);
      }
    } else {
      result.width = this._layoutRect.width;
    }

    if (this._layoutRectLevelMap.height < USER_LAYOUT_RECT_LEVEL) {
      if (!isNil(this._minHeight)) {
        result.height = Math.max(result.height, this._minHeight);
      }
      if (!isNil(this._maxHeight)) {
        result.height = Math.min(result.height, this._maxHeight);
      }
    } else {
      result.height = this._layoutRect.height;
    }
    return result;
  }

  computeBoundsInRect(rect: ILayoutRect): ILayoutRect {
    // 保留布局使用的rect
    this._lastComputeRect = rect;

    if (
      (this.layoutType === 'region-relative' || this.layoutType === 'region-relative-overlap') &&
      ((this._layoutRectLevelMap.width === USER_LAYOUT_RECT_LEVEL &&
        (this.layoutOrient === 'left' || this.layoutOrient === 'right')) ||
        (this._layoutRectLevelMap.height === USER_LAYOUT_RECT_LEVEL &&
          (this.layoutOrient === 'bottom' || this.layoutOrient === 'top')))
    ) {
      return this._layoutRect;
    }
    // 将布局空间限制到 spec 设置内
    // 避免操作到元素本身的 aabbbounds
    const bounds = { ...this._model.getBoundsInRect(this.setRectInSpec(rect), rect) };
    // 用户设置了布局元素宽高的场景下，内部布局结果的 bounds 不能直接作为图表布局bounds
    this.changeBoundsBySetting(bounds);
    // 保留当前模块的布局超出内容,用来处理自动缩进
    // 当前 bounds 需要有实际宽高
    if (this.autoIndent && bounds.x2 - bounds.x1 > 0 && bounds.y2 - bounds.y1 > 0) {
      this._lastComputeOutBounds.x1 = Math.ceil(-bounds.x1);
      this._lastComputeOutBounds.x2 = Math.ceil(bounds.x2 - rect.width);
      this._lastComputeOutBounds.y1 = Math.ceil(-bounds.y1);
      this._lastComputeOutBounds.y2 = Math.ceil(bounds.y2 - rect.height);
    }
    // 返回的布局大小也要限制到 spec 设置内
    let result = this.setRectInSpec(boundsInRect(bounds, rect));
    if (this._option.transformLayoutRect) {
      result = this._option.transformLayoutRect(result);
    }

    return result;
  }

  getModelId() {
    return this._model.id;
  }

  getModelVisible() {
    return this._model.getVisible();
  }

  setWillLayoutTag() {
    this._willLayoutTag = true;
  }

  clearWillLayoutTag() {
    this._willLayoutTag = false;
  }
}
