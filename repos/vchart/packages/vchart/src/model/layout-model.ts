import type { IBoundsLike } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isEqual, merge } from '@visactor/vutils';
import type { ILayoutItem } from '../layout/interface';
import type { IOrientType, IPadding, IPolarOrientType, IRect } from '../typings/space';
import { BaseModel } from './base-model';
import type { IModelSpec } from './interface';
import { LayoutItem } from '../layout/layout-item';
import type { IPoint } from '../typings/coordinate';
import type { ILayoutType, ILayoutPoint, ILayoutRect } from '../typings/layout';

export abstract class LayoutModel<T extends IModelSpec> extends BaseModel<T> {
  protected layoutType: ILayoutType | 'none' = 'normal';
  protected layoutLevel?: number = 0;
  protected layoutZIndex: number = 0;
  layoutClip: boolean;
  get layoutOrient() {
    return this._orient as IOrientType;
  }

  set layoutOrient(v: IOrientType) {
    this._orient = v;
    this._layout && (this._layout.layoutOrient = v);
  }

  protected _forceLayoutTag: boolean = false;
  protected _layout: ILayoutItem = null;
  protected _orient?: IPolarOrientType | IOrientType = null;

  protected _layoutRect: ILayoutRect = { width: 0, height: 0 };
  protected _layoutStartPos: IPoint = { x: 0, y: 0 };

  // TODO: 有些hack,这个tag是为了避免布局逻辑中，轴的数据变化，又由数据变化触发重新布局
  protected _isLayout: boolean = true;

  initLayout() {
    if (this.layoutType === 'none') {
      return;
    }
    this._layout = new LayoutItem(this, {
      layoutType: this.layoutType,
      layoutLevel: this.layoutLevel,
      layoutOrient: this._orient as IOrientType,
      transformLayoutRect: this._transformLayoutRect,
      transformLayoutPosition: this._transformLayoutPosition,
      transformLayoutPadding: this._transformLayoutPadding
    });
    if (this._orient && this._orient !== 'radius' && this._orient !== 'angle' && this._layout) {
      this._layout.layoutOrient = this._orient;
    }
  }

  onLayoutStart(layoutRect: IRect, viewRect: ILayoutRect): void {
    this._isLayout = true;
    super.onLayoutStart(layoutRect, viewRect);
  }
  onLayoutEnd(): void {
    super.onLayoutEnd();
    // diff layoutRect
    this.updateLayoutAttribute();
    const layoutRect = this.getLayoutRect();
    if (this._forceLayoutTag || !isEqual(this._lastLayoutRect, layoutRect)) {
      this._lastLayoutRect = { ...layoutRect };
    }
    this._forceLayoutTag = false;
    this._isLayout = false;
  }

  afterSetLayoutStartPoint(_pos: ILayoutPoint) {
    // do nothing
  }

  protected _forceLayout() {
    if (this._isLayout) {
      return;
    }
    this._layout?.setWillLayoutTag();
    this._forceLayoutTag = true;
    this._option.globalInstance.getChart()?.setLayoutTag(true);
  }

  // 布局相关
  getLayoutStartPoint() {
    return this._layout ? this._layout.getLayoutStartPoint() : this._layoutStartPos;
  }
  setLayoutStartPosition(pos: Partial<IPoint>) {
    return this._layout
      ? this._layout.setLayoutStartPosition(pos)
      : (this._layoutStartPos = merge(this._layoutStartPos, pos));
  }
  getLayoutRect() {
    return this._layout ? this._layout.getLayoutRect() : this._layoutRect;
  }
  setLayoutRect(rect: Partial<ILayoutRect>, levelMap?: Partial<ILayoutRect>) {
    return this._layout ? this._layout.setLayoutRect(rect) : (this._lastLayoutRect = merge(this._layoutRect, rect));
  }

  getLastComputeOutBounds() {
    return this._layout?.getLastComputeOutBounds();
  }

  getGraphicBounds = () => {
    if (this._layout) {
      return {
        x1: this._layout.getLayoutStartPoint().x,
        y1: this._layout.getLayoutStartPoint().y,
        x2: this._layout.getLayoutStartPoint().x + this._layout.getLayoutRect().width,
        y2: this._layout.getLayoutStartPoint().y + this._layout.getLayoutRect().height
      };
    }
    return { x1: 0, x2: 0, y1: 0, y2: 0 };
  };

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this.layoutClip = this._spec.clip ?? this.layoutClip;
    this.layoutZIndex = this._spec.zIndex ?? this.layoutZIndex;
    this.layoutType = this._spec.layoutType ?? this.layoutType;
    this._orient = this._spec.orient ?? this._orient;
    this.layoutLevel = this._spec.layoutLevel ?? this.layoutLevel;
  }

  abstract getBoundsInRect(rect: ILayoutRect, fullRect: ILayoutRect): IBoundsLike;

  protected _transformLayoutRect: (rect: ILayoutRect) => ILayoutRect = null;
  protected _transformLayoutPosition: (rect: Partial<IPoint>) => Partial<IPoint> = null;
  protected _transformLayoutPadding: (padding: IPadding) => IPadding = null;
}
