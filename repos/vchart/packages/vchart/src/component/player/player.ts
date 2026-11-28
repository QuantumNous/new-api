import { Factory } from './../../core/factory';
import type { INode, IGroup, IGraphic } from '@visactor/vrender-core';
import type { ContinuousPlayerAttributes, DiscretePlayerAttributes } from '@visactor/vrender-components';

// eslint-disable-next-line no-duplicate-imports
import { DiscretePlayer, ContinuousPlayer, PlayerEventEnum } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import { isNumber, array, isEqual, isValidNumber } from '@visactor/vutils';

import type { IModelRenderOption } from '../../model/interface';
import type { IRegion } from '../../region/interface';

import type { DirectionType, IPlayer } from './interface';
// eslint-disable-next-line no-duplicate-imports
import type { IComponent } from '../interface';
import type { IPoint, IOrientType, ILayoutRect, IChartSpec, IDataValues } from '../../typings';

// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../interface/type';
import { BaseComponent } from '../base/base-component';
import { transformContinuousSpecToAttrs, transformDiscreteSpecToAttrs } from './utils/transform';
import { isHorizontal, isVertical } from './utils/orient';
import { LayoutLevel, LayoutZIndex } from '../../constant/layout';
import { ChartEvent } from '../../constant/event';
import { player } from '../../theme/builtin/common/component/player';

export class Player extends BaseComponent<IPlayer> implements IComponent {
  layoutZIndex: number = LayoutZIndex.Player;
  layoutLevel: number = LayoutLevel.Player;

  static readonly builtInTheme = {
    player
  };

  static specKey = 'player';
  specKey: string = 'player';

  static type = ComponentTypeEnum.player;
  type = ComponentTypeEnum.player;
  protected _orient: IOrientType = 'bottom';
  private _specs: Partial<IChartSpec>[];

  private _playerComponent: DiscretePlayer | ContinuousPlayer;
  private _cacheAttrs: ContinuousPlayerAttributes | DiscretePlayerAttributes;

  private _visible: boolean;
  private _direction: DirectionType;
  private _alternate: boolean;
  private _dx: number;
  private _dy: number;
  private _width: number;
  private _height: number;
  private _position: 'start' | 'middle' | 'end';

  get orient() {
    return this._orient;
  }

  set layoutOrient(v: IOrientType) {
    this._orient = v;
  }

  /**
   * 设置Attr
   */
  setAttrFromSpec() {
    super.setAttrFromSpec();
    this._orient = this._spec.orient ?? 'bottom';
    this._specs = this._spec.specs ?? [];
    this._direction = this._spec.direction ?? 'default';
    this._alternate = this._spec.alternate ?? false;
    this._dx = this._spec.dx ?? 0;
    this._dy = this._spec.dy ?? 0;
    this._position = this._spec.position ?? 'middle';
    this._visible = this._spec.visible ?? true;
  }

  _compareSpec(spec: IPlayer, prevSpec: IPlayer) {
    const result = super._compareSpec(spec, prevSpec);
    const specChanged = !isEqual(prevSpec, spec);

    if (prevSpec?.type !== spec?.type) {
      result.reMake = true;
      return result;
    }
    if (specChanged && !result.reMake && !result.reCompile) {
      result.change = true;
      result.reRender = true;
      result.effects = {
        ...result.effects,
        component: true,
        layout: true,
        render: true
      };
    }

    return result;
  }

  /**
   * 计算组件位置(布局的左上角起点)
   * @param pos
   */
  afterSetLayoutStartPoint(pos: IPoint) {
    super.afterSetLayoutStartPoint(pos);
    if (isValidNumber(pos.x)) {
      const offsetX = isVertical(this._orient) ? pos.x + this._sliderExceededSize() / 2 : pos.x;
      this._playerComponent && this._playerComponent.setAttribute('x', offsetX);
    }
    if (isValidNumber(pos.y)) {
      const offsetY = isHorizontal(this._orient) ? pos.y + this._sliderExceededSize() / 2 : pos.y;
      this._playerComponent && this._playerComponent.setAttribute('y', offsetY);
    }
  }

  /**
   * 计算组件占用的bound box
   * @param rect
   * @returns
   */
  getBoundsInRect(rect: ILayoutRect, fullSpace: ILayoutRect) {
    this._width = this._computeWidth(rect);
    this._height = this._computeHeight(rect);
    this._dx = this._computeDx(fullSpace);
    this._dy = this._computeDy(fullSpace);

    const bounds = this._computeLayoutRect(rect, this._width, this._height);

    this._createOrUpdatePlayerComponent();

    return bounds;
  }

  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [this._playerComponent] as unknown as IGroup[];
  }

  /**
   * 播放器属性
   */
  private _getPlayerAttrs = () => {
    const type = this._spec.type;
    const layoutAttrs = {
      size: {
        width: this._width,
        height: this._height
      },
      dx: this._spec.dx ?? 0 + this._dx,
      dy: this._spec.dy ?? 0 + this._dy
    };
    // 离散类型Attrs
    if (type === 'discrete') {
      return {
        ...transformDiscreteSpecToAttrs(this._spec, this._specs),
        ...layoutAttrs,
        disableTriggerEvent: this._option.disableTriggerEvent,
        loop: this._spec?.loop ?? true
      };
    }
    // 连续类型Attrs
    return {
      ...transformContinuousSpecToAttrs(this._spec, this._specs),
      ...layoutAttrs,
      disableTriggerEvent: this._option.disableTriggerEvent,
      loop: this._spec?.loop ?? true
    };
  };

  /**
   * 创建或更新播放器组件
   */
  private _createOrUpdatePlayerComponent = () => {
    const attrs = { ...this._getPlayerAttrs() };
    const container = this.getContainer();
    if (this._playerComponent) {
      if (!isEqual(attrs, this._cacheAttrs)) {
        this._cacheAttrs = attrs;
        this._playerComponent.setAttributes(attrs);
        // FIXME: player 组件没有重写 setAttributes 方法，因此不能正常更新样式。以下两句模拟执行了 setAttributes 方法，但是应在 vrender-component 的后续版本中实现 setAttributes 方法
        this._playerComponent._initAttributes();
        this._playerComponent.render();
      }
    } else {
      if (attrs.type === 'discrete') {
        this._playerComponent = new DiscretePlayer(attrs);
      } else {
        this._playerComponent = new ContinuousPlayer(attrs);
      }

      this._cacheAttrs = attrs;
      this._playerComponent.name = `player`;

      container.add(this._playerComponent as unknown as INode);

      this._initEvent();
    }
  };

  /**
   * 计算起点
   */
  private _computeLayoutRect(rect: ILayoutRect, width: number, height: number) {
    // don't set bounds when player hidden
    if (this._visible === false) {
      return { x1: 0, x2: 0, y1: 0, y2: 0 };
    }
    // set bounds by 4 kinds of orient
    switch (this._orient) {
      case 'top': {
        return { x1: 0, y1: 0, x2: width, y2: height };
      }
      case 'right': {
        return { x1: rect.width - width, y1: 0, x2: rect.width, y2: rect.height };
      }
      case 'left': {
        return { x1: 0, y1: 0, x2: width, y2: height };
      }
      case 'bottom':
      default: {
        return { x1: 0, y1: rect.height - height, x2: rect.width, y2: rect.height };
      }
    }
  }

  /**
   * 计算组件宽度
   */
  private _computeWidth(rect: ILayoutRect) {
    // 若设置的是数值则直接返回
    if (isNumber(this._spec.width)) {
      return Math.min(rect.width, Number(this._spec.width));
    }

    if (isVertical(this._orient)) {
      return this._maxSize();
    }
    return rect.width;
  }

  /**
   * 计算组件高度
   */
  private _computeHeight(rect: ILayoutRect) {
    // 若设置的是数值则直接返回
    if (isNumber(this._spec.height)) {
      this._height = this._spec.height;
      return Math.min(rect.height, Number(this._spec.height));
    }

    if (isHorizontal(this._orient)) {
      return this._maxSize();
    }
    return rect.height;
  }

  /**
   * 计算x方向的偏移, 用于实现对齐
   */
  private _computeDx(rect: ILayoutRect) {
    // 垂直时, x不偏移
    if (isVertical(this._orient)) {
      return 0;
    }

    // start
    if (this._position === 'start') {
      return 0;
    }
    // middle
    else if (this._position === 'middle') {
      return (rect.width - this._width) / 2;
    }
    // end
    return rect.width - this._width;
  }

  /**
   * 计算y方向的偏移, 用于实现对齐
   */
  private _computeDy(rect: ILayoutRect) {
    // 水平时, y不偏移
    if (isHorizontal(this._orient)) {
      return 0;
    }

    // start
    if (this._position === 'start') {
      return 0;
    }
    // middle
    else if (this._position === 'middle') {
      return (rect.height - this._height) / 2;
    }

    // end
    return rect.height - this._height;
  }

  /**
   * 播放器宽度取计算子组件中最高的一个
   */
  private _maxSize = () => {
    return Math.max(
      ...array(this._spec.controller.start?.style?.size),
      ...array(this._spec.controller.pause?.style?.size),
      ...array(this._spec.controller.backward?.style?.size),
      ...array(this._spec.controller.forward?.style?.size),
      (isVertical(this._orient) ? this._spec.slider.railStyle.width : this._spec.slider.railStyle.height) ?? 10
    );
  };

  /**
   * 滑动条超过按钮的高度
   */
  private _sliderExceededSize = () => {
    const sliderHeight =
      (isVertical(this._orient) ? this._spec.slider.railStyle.width : this._spec.slider.railStyle.height) ?? 10;
    const controllersHeight = Math.max(
      ...array(this._spec.controller.start?.style?.size),
      ...array(this._spec.controller.pause?.style?.size),
      ...array(this._spec.controller.backward?.style?.size),
      ...array(this._spec.controller.forward?.style?.size)
    );
    if (sliderHeight >= controllersHeight) {
      return sliderHeight - controllersHeight;
    }
    return 0;
  };

  changePlayerIndex(index: number) {
    const spec = this._specs?.[index];

    if (!spec || !this._option?.globalInstance) {
      return;
    }

    this._option.globalInstance.updateFullData((spec as any).data);

    this.event.emit(ChartEvent.playerChange, {
      model: this,
      value: {
        spec: spec,
        index: index,
        specs: this._specs
      }
    });
  }
  autoPlayCallback = () => {
    if (this._spec?.auto && this._playerComponent) {
      this._playerComponent.pause();
      this._playerComponent.play();
    }
  };
  /**
   * 事件
   */
  private _initEvent = () => {
    if (this._option.disableTriggerEvent) {
      return;
    }
    // 自动播放
    this._option.globalInstance.off(ChartEvent.rendered, this.autoPlayCallback);
    // 自动播放
    this._option.globalInstance.on(ChartEvent.rendered, this.autoPlayCallback);

    // 循环播放 与 交替方向
    this._playerComponent.addEventListener(PlayerEventEnum.end, () => {
      this.event.emit(ChartEvent.playerEnd, { model: this });

      // 交替方向, 仅离散轴支持
      if (this._alternate && this._spec.type === 'discrete') {
        this._direction = this._direction === 'default' ? 'reverse' : 'default';
        this._playerComponent.setAttributes({
          direction: this._direction,
          dataIndex: this._direction === 'reverse' ? this._specs.length - 2 : 1
        });
      }

      // 循环播放
      if (this._spec?.loop) {
        this._playerComponent.play();
      }
    });

    // 数据更新
    this._playerComponent.addEventListener(PlayerEventEnum.change, (e: { detail: { index: number } }) => {
      // 更新data
      const { index } = e.detail;
      this.changePlayerIndex(index);
    });

    // 后退
    this._playerComponent.addEventListener(PlayerEventEnum.backward, (e: { detail: { index: number } }) => {
      const { index } = e.detail;
      const spec = this._specs[index];
      this.event.emit(ChartEvent.playerBackward, {
        model: this,
        value: {
          spec: spec,
          index: index,
          specs: this._specs
        }
      });
    });

    // 前进
    this._playerComponent.addEventListener(PlayerEventEnum.forward, (e: { detail: { index: number } }) => {
      const { index } = e.detail;
      const spec = this._specs[index];
      this.event.emit(ChartEvent.playerForward, {
        model: this,
        value: {
          spec: spec,
          index: index,
          specs: this._specs
        }
      });
    });

    // 播放
    this._playerComponent.addEventListener(PlayerEventEnum.play, (e: { detail: { index: number } }) => {
      const { index } = e.detail;
      const spec = this._specs[index];
      this.event.emit(ChartEvent.playerPlay, {
        model: this,
        value: {
          spec: spec,
          index: index,
          specs: this._specs
        }
      });
    });

    // 暂停
    this._playerComponent.addEventListener(PlayerEventEnum.pause, (e: { detail: { index: number } }) => {
      const { index } = e.detail;
      const spec = this._specs[index];
      this.event.emit(ChartEvent.playerPause, {
        model: this,
        value: {
          spec: spec,
          index: index,
          specs: this._specs
        }
      });
    });
  };
  release(): void {
    this._playerComponent?.pause?.();
    // 自动播放
    this._option?.globalInstance?.off(ChartEvent.rendered, this.autoPlayCallback);
    super.release();
    this._playerComponent = null as unknown as DiscretePlayer | ContinuousPlayer;
    this._cacheAttrs = null as unknown as ContinuousPlayerAttributes | DiscretePlayerAttributes;
    this._specs = [];
  }
}

export const registerPlayer = () => {
  Factory.registerComponent(Player.type, Player);
};
