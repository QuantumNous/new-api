import type { IGraphicAttribute, IGraphic, IGroup, INode } from '@visactor/vrender-core';
import { CustomEvent } from '@visactor/vrender-core/event/constant';
import type { IRegion } from '../../region/interface';
import type { IComponent, IComponentOption } from '../interface';
import { ComponentPluginService } from '../../plugin/components/plugin-service';
import type { IComponentPluginService, IComponentPlugin } from '../../plugin/components/interface';
import type { IBoundsLike } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { isEqual } from '@visactor/vutils';
import { Event_Source_Type } from '../../constant/event';
// import { preprocessSpecOrTheme } from '../../util/spec/preprocess';
import type { Datum, ILayoutRect } from '../../typings';
import type { IComponentSpec } from './interface';
import { LayoutModel } from '../../model/layout-model';
import { BaseComponentSpecTransformer } from './base-component-transformer';
import type { IModelSpecInfo } from '../../model/interface';
import {
  collectVRenderComponents,
  releaseVRenderComponent,
  releaseVRenderComponentSync
} from './release-vrender-component';

export class BaseComponent<T extends IComponentSpec = IComponentSpec> extends LayoutModel<T> implements IComponent {
  static transformerConstructor = BaseComponentSpecTransformer;
  name: string = 'component';
  readonly modelType: string = 'component';
  readonly transformerConstructor = BaseComponentSpecTransformer as any;
  pluginService?: IComponentPluginService;

  static createComponent(specInfo: IModelSpecInfo, options: IComponentOption): IComponent {
    const { spec, ...others } = specInfo;
    return new this(spec, {
      ...options,
      ...others
    });
  }

  protected declare _option: IComponentOption;

  protected _regions: IRegion[];
  getRegions() {
    return this._regions;
  }

  protected _container: IGroup;
  private _exitingVRenderComponents?: Set<IGraphic>;
  private _forceReleaseVRenderComponents: boolean = false;

  created() {
    super.created();
    this.initLayout();
    this.pluginService = new ComponentPluginService(this);
  }

  initLayout(): void {
    super.initLayout();
    this._regions = this._regions ?? this._option.getRegionsInIndex();
    this._layout && (this._layout.layoutBindRegionID = this._regions.map(x => x?.id));
  }
  /**
   * 当创建vrender组件时，reCompile 的时候需要清理老的组件，创建新的组件，需要通过这个返回
   * 注意，像label 组件比较特殊，现在是通过componentMark 管理的，所以不需要通过这个接口被清理
   */
  protected _getNeedClearVRenderComponents(): IGraphic[] {
    return [];
  }

  getVRenderComponents() {
    return this._getNeedClearVRenderComponents();
  }

  protected callPlugin(cb: (plugin: IComponentPlugin) => void) {
    if (this.pluginService) {
      this.pluginService.getAll().forEach(plugin => cb(plugin));
    }
  }

  protected getContainer() {
    if (!this._container) {
      this._container = this._option?.globalInstance.getStage().find(node => node.name === 'root', true) as IGroup;
    }

    return this._container;
  }

  /**
   * updateSpec
   */
  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    if (!result.reMake) {
      result.reMake = ['seriesId', 'seriesIndex', 'regionId', 'regionIndex'].some(k => {
        return !isEqual(prevSpec?.[k], spec[k]);
      });
    }
    if ((prevSpec as any)?.visible !== (spec as any).visible) {
      result.reCompile = true;
    }
    return result;
  }

  beforeRelease() {
    super.beforeRelease();
    this._forceReleaseVRenderComponents = true;
    this._forceReleaseExitingVRenderComponents();
  }

  release() {
    if (this._shouldReleaseVRenderComponentsImmediately()) {
      this._forceReleaseExitingVRenderComponents();
    }
    this.clear();
    super.release();

    this.pluginService?.releaseAll();
    this.pluginService = null;
  }

  protected _shouldReleaseVRenderComponentsImmediately() {
    return this._forceReleaseVRenderComponents;
  }

  protected _forceReleaseExitingVRenderComponents() {
    if (!this._exitingVRenderComponents?.size) {
      return;
    }

    this._exitingVRenderComponents.forEach(component => {
      releaseVRenderComponentSync(component);
      (this._option?.globalInstance as any)?._unregisterExitingVRenderComponent?.(component);
    });
    this._exitingVRenderComponents.clear();
  }

  protected _releaseVRenderComponent(component: IGraphic) {
    const forceRelease = this._shouldReleaseVRenderComponentsImmediately();

    if (!forceRelease) {
      const exitingComponents = collectVRenderComponents(component);
      const releasedWithExit = releaseVRenderComponent(component, {
        enableExitAnimation: true,
        removeFromParent: true,
        onComplete: () => {
          exitingComponents.forEach(exitingComponent => {
            this._exitingVRenderComponents?.delete(exitingComponent);
            (this._option?.globalInstance as any)?._unregisterExitingVRenderComponent?.(exitingComponent);
          });
        }
      });

      if (releasedWithExit) {
        this._exitingVRenderComponents = this._exitingVRenderComponents ?? new Set();
        exitingComponents.forEach(exitingComponent => {
          this._exitingVRenderComponents.add(exitingComponent);
          (this._option?.globalInstance as any)?._registerExitingVRenderComponent?.(exitingComponent);
        });
        return;
      }

      return;
    }

    releaseVRenderComponentSync(component);
  }

  clear() {
    const components = this._getNeedClearVRenderComponents();
    if (components && components.length) {
      components.forEach(c => {
        if (c) {
          this._releaseVRenderComponent(c);
        }
      });
    }
    this._container = null;
    this.pluginService?.clearAll();
  }

  compile(): void {
    this.compileMarks();
    this.reAppendComponents();
  }

  compileMarks(group?: IGroup) {
    this.getMarks().forEach(m => {
      m.compile({ group, context: { model: this } });
    });
  }

  reAppendComponents() {
    const components = this._getNeedClearVRenderComponents();
    if (components && components.length) {
      components.forEach(c => {
        if (c && !c.stage) {
          // component is removed remove stage

          this.getContainer()?.appendChild(c as unknown as INode);
        }
      });
    }
  }

  // 代理组件本身的事件（非内部图形），如坐标轴整体的点击等
  protected _delegateEvent = (component: IGraphic, event: any, type: string, item: any = null, datum: Datum = null) => {
    // 组件这里只代理基础的事件，自定义事件不需要代理
    if (!(event instanceof CustomEvent)) {
      this.event.emit(
        type,
        {
          model: this,
          node: component,
          event,
          item: item,
          datum: datum,
          source: Event_Source_Type.chart,
          chart: this._option?.globalInstance?.getChart()
        },
        'model'
      );
    }
  };

  getBoundsInRect(rect: ILayoutRect, fullRect: ILayoutRect): IBoundsLike {
    return { x1: 0, x2: 0, y1: 0, y2: 0 };
  }

  getDatum(graphic?: IGraphic<Partial<IGraphicAttribute>>) {
    // override
    return;
  }
}
