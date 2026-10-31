import { LayoutLevel, LayoutZIndex } from '../../constant/layout';
import { Factory } from '../../core/factory';
import type { IModelSpecInfo } from '../../model/interface';
import type { IRegion } from '../../region/interface';
import type { IPoint, IOrientType, ILayoutType, ILayoutRect } from '../../typings';
import { calcLayoutNumber, isValidOrient } from '../../util/space';
import { BaseComponent } from '../base/base-component';
// eslint-disable-next-line no-duplicate-imports
import type { IComponentOption } from '../interface';
import { ComponentTypeEnum } from '../interface/type';
import type { ITitle, ITitleSpec } from './interface';
import { Title as TitleComponents } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import type { TitleAttrs } from '@visactor/vrender-components';
import type { IGraphic, IGroup, INode } from '@visactor/vrender-core';
import type { Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isEqual, isValidNumber, pickWithout, isValid } from '@visactor/vutils';
import { getSpecInfo } from '../util';
import { title } from '../../theme/builtin/common/component/title';

export class Title<T extends ITitleSpec = ITitleSpec> extends BaseComponent<T> implements ITitle {
  static type = ComponentTypeEnum.title;
  type = ComponentTypeEnum.title;
  static specKey = ComponentTypeEnum.title;
  specKey: string = ComponentTypeEnum.title;

  layoutType: ILayoutType = 'normal';
  layoutZIndex: number = LayoutZIndex.Title;
  layoutLevel: number = LayoutLevel.Title;

  static readonly builtInTheme = {
    title
  };

  protected _orient: IOrientType = 'top';

  private _titleComponent: TitleComponents;
  private _cacheAttrs: TitleAttrs;

  get orient() {
    return this._orient;
  }

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);
    this._orient = isValidOrient(spec.orient) ? spec.orient : 'top';
  }

  initLayout(): void {
    super.initLayout();
    this._layout && (this._layout.layoutOrient = this._orient);
  }

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    return getSpecInfo<ITitleSpec>(chartSpec, this.specKey, ComponentTypeEnum.title, (s: ITitleSpec) => {
      return s.visible !== false;
    });
  }

  /**
   * updateSpec
   */
  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    const specChanged = !isEqual(prevSpec, spec);

    if (prevSpec?.orient !== spec?.orient || (prevSpec as any)?.visible !== (spec as any).visible) {
      // title 组件切换visible会影响布局，所以需要重新remake
      result.reMake = true;
    }

    result.change = true;
    result.reRender = true;
    if (specChanged && !result.reMake) {
      result.effects = {
        ...result.effects,
        component: true,
        layout: true,
        render: true
      };
    }
    return result;
  }

  afterSetLayoutStartPoint(pos: IPoint): void {
    if (isValidNumber(pos.x)) {
      this._titleComponent && this._titleComponent.setAttribute('x', pos.x);
    }
    if (isValidNumber(pos.y)) {
      this._titleComponent && this._titleComponent.setAttribute('y', pos.y);
    }
    super.afterSetLayoutStartPoint(pos);
  }

  getBoundsInRect(rect: ILayoutRect) {
    let result: Partial<ILayoutRect> = {};
    this.setLayoutRect(rect);

    const attrs = this._getTitleAttrs();
    this._createOrUpdateTitleComponent(attrs);

    result = this._getTitleLayoutRect();
    const { x, y } = this.getLayoutStartPoint();
    return {
      x1: x,
      y1: y,
      x2: x + result.width,
      y2: y + result.height
    };
  }

  private _getTitleLayoutRect() {
    const titleBounds = this._titleComponent.AABBBounds;
    const width = this._spec.width ? this._spec.width : isValidNumber(titleBounds.width()) ? titleBounds.width() : 0;
    const height = this._spec.height
      ? this._spec.height
      : isValidNumber(titleBounds.height())
      ? titleBounds.height()
      : 0;
    return {
      width,
      height
    };
  }

  private _getTitleAttrs() {
    /**
     * 生成标题组件的渲染属性，统一计算宽高与对齐参数，
     * 并在仅副标题场景下避免主标题宽度影响副标题布局。
     */
    if (this._spec.visible === false) {
      return { visible: false };
    }
    const layoutRect = this.getLayoutRect();
    const titleWidth = calcLayoutNumber(this._spec.width, layoutRect.width, null, layoutRect.width);
    const titleMaxWidth = calcLayoutNumber(this._spec.maxWidth, layoutRect.width, null, layoutRect.width);
    const maxWidth = Math.max(Math.min(titleWidth, titleMaxWidth, layoutRect.width), 0);
    const hasText = isValid(this._spec.text) && this._spec.text !== '';
    const hasSubtext = isValid(this._spec.subtext) && this._spec.subtext !== '';

    const attrs = {
      ...(pickWithout(this._spec, ['padding']) as any),
      textType: this._spec.textType ?? 'text',
      text: hasText ? this._spec.text : undefined,
      subtextType: this._spec.subtextType ?? 'text',
      subtext: hasSubtext ? this._spec.subtext : undefined,
      x: this._spec.x ?? 0,
      y: this._spec.y ?? 0,
      height: this._spec.height,
      minWidth: this._spec.minWidth,
      maxWidth,
      minHeight: this._spec.minHeight,
      maxHeight: this._spec.maxHeight,
      padding: this._spec.innerPadding,
      align: this._spec.align ?? 'left',
      verticalAlign: this._spec.verticalAlign ?? 'top',
      textStyle: {
        maxLineWidth: maxWidth,
        ...this._spec.textStyle
      },
      subtextStyle: {
        maxLineWidth: maxWidth,
        ...this._spec.subtextStyle
      }
    } as TitleAttrs;

    // 仅在对应文本存在时设置 width，避免空主标题影响副标题的对齐与宽度计算
    if (hasText) {
      (attrs.textStyle as any).width = maxWidth;
    }
    if (hasSubtext) {
      (attrs.subtextStyle as any).width = maxWidth;
    }

    if (isValid(this._spec.width)) {
      const clampedWidth = Math.max(Math.min(titleWidth, layoutRect.width), 0);
      if (hasText) {
        (attrs.textStyle as any).width = clampedWidth;
      } else {
        // 主标题不存在时，不设置其 width
        delete (attrs.textStyle as any).width;
      }
      if (hasSubtext) {
        (attrs.subtextStyle as any).width = clampedWidth;
      }
    }
    return attrs;
  }

  private _createOrUpdateTitleComponent(attrs: TitleAttrs): TitleComponents {
    if (this._titleComponent) {
      if (!isEqual(attrs, this._cacheAttrs)) {
        this._titleComponent.setAttributes(attrs);
      }
    } else {
      const container = this.getContainer();
      const title = new TitleComponents(attrs);
      title.name = 'title';
      container.add(title as unknown as INode);
      this._titleComponent = title;
      // 代理 title 组件上的事件
      title.on('*', (event: any, type: string) => this._delegateEvent(title as unknown as IGraphic, event, type));
    }
    this._cacheAttrs = attrs;
    return this._titleComponent;
  }

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._titleComponent] as unknown as IGroup[];
  }

  clear(): void {
    super.clear();
    this._cacheAttrs = null;
  }
}

export const registerTitle = () => {
  Factory.registerComponent(Title.type, Title);
};
