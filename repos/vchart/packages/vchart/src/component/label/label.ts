import type { IComponentOption } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../interface/type';
import type { IRegion } from '../../region/interface';
import type { IModelInitOption, IModelSpecInfo } from '../../model/interface';
import { STACK_FIELD_TOTAL_BOTTOM, STACK_FIELD_TOTAL_TOP } from '../../constant/data';
import { ChartEvent, HOOK_EVENT } from '../../constant/event';
import { AttributeLevel } from '../../constant/attribute';
import { LayoutZIndex } from '../../constant/layout';
import type { IMark } from '../../mark/interface';
import { type IComponentMark, type ILabelMark } from '../../mark/interface';
import { MarkTypeEnum } from '../../mark/interface/type';
import { mergeSpec } from '@visactor/vutils-extension';
import { eachSeries } from '../../util/model';
import type { ISeries, SeriesMarkNameEnum } from '../../series/interface';
// eslint-disable-next-line no-duplicate-imports
import { defaultLabelConfig, textAttribute } from './util';
// eslint-disable-next-line no-duplicate-imports
import { registerComponentMark } from '../../mark/component';
import { BaseLabelComponent } from './base-label';
import type { Maybe } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import { array, isArray, isFunction, isValid, pickWithout } from '@visactor/vutils';
import type { ILabelInfo, ILabelSpec, TransformedLabelSpec } from './interface';
import { Factory } from '../../core/factory';
// eslint-disable-next-line no-duplicate-imports
import { registerLabelMark } from '../../mark/label';
import type { IChartSpecInfo } from '../../chart/interface';
import type { Datum, IChartSpec } from '../../typings';
import { LabelSpecTransformer } from './label-transformer';
import type { IGraphic, IGroup } from '@visactor/vrender-core';
import type { DataLabelAttrs } from '@visactor/vrender-components/label';
import { DataLabel } from '@visactor/vrender-components/label';

export class Label<T extends IChartSpec = any> extends BaseLabelComponent<T> {
  static type = ComponentTypeEnum.label;
  type = ComponentTypeEnum.label;
  name: string = ComponentTypeEnum.label;

  static specKey = 'label';
  specKey = 'label';

  static readonly transformerConstructor = LabelSpecTransformer as any;
  readonly transformerConstructor = LabelSpecTransformer;

  layoutZIndex: number = LayoutZIndex.Label;

  protected _labelInfoMap: Map<IRegion, ILabelInfo[]>;

  protected _labelComponentMap: Map<IComponentMark, () => ILabelInfo | ILabelInfo[]>;

  protected _layoutRule: 'series' | 'region';

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);
    this._layoutRule = (spec as any).labelLayout || 'series';
  }

  static getSpecInfo(chartSpec: any, chartSpecInfo: IChartSpecInfo): Maybe<IModelSpecInfo[]> {
    const specInfo: IModelSpecInfo[] = [];
    const regionSpecInfo = chartSpecInfo?.region || [];
    const isLabelVisible = (labelSpecList: ILabelSpec[]) => {
      return labelSpecList.some(labelSpec => labelSpec.visible);
    };

    regionSpecInfo.forEach((regionInfo, i) => {
      const seriesIndexes = regionInfo.seriesIndexes || [];
      const hasVisibleLabel = seriesIndexes.some(seriesIndex => {
        const seriesInfo = chartSpecInfo.series[seriesIndex];
        const { markLabelSpec = {} } = seriesInfo;

        return Object.values(markLabelSpec).some(
          labelSpecList => Array.isArray(labelSpecList) && isLabelVisible(labelSpecList)
        );
      });
      if (hasVisibleLabel) {
        specInfo.push({
          spec: chartSpec,
          type: ComponentTypeEnum.label,
          specInfoPath: ['component', this.specKey, i],
          regionIndexes: [i]
        });
      }
    });
    return specInfo;
  }

  init(option: IModelInitOption): void {
    super.init(option);
    this.initEvent();
    this._initTextMark();
    this._initLabelComponent();
    this._initTextMarkStyle();
  }

  reInit(spec?: T) {
    super.reInit(spec);

    if (this._labelInfoMap) {
      this._labelInfoMap.forEach(labelInfos => {
        labelInfos.forEach(({ labelMark }) => {
          labelMark.release();
        });
      });
      this._labelInfoMap.clear();
    }
    this._labelInfoMap && this._labelInfoMap.clear();
    this._initTextMark();
    this._initLabelComponent();
    this._initTextMarkStyle();
  }

  initEvent() {
    this.event.on(ChartEvent.dataZoomChange, () => {
      this._labelComponentMap.forEach((info, component) => {
        const graphicItem = component.getComponent();
        if (graphicItem) {
          graphicItem.disableAnimation();
        }
      });
      this.event.on(HOOK_EVENT.AFTER_MARK_RENDER_END, enableAnimation);
    });
    const enableAnimation = () => {
      this._labelComponentMap.forEach((info, component) => {
        const graphicItem = component.getComponent();
        if (graphicItem) {
          graphicItem.enableAnimation();
        }
      });
      this.event.off(HOOK_EVENT.AFTER_MARK_RENDER_END, enableAnimation);
    };
  }

  protected _initTextMark() {
    if (!this._labelInfoMap) {
      this._labelInfoMap = new Map();
    }

    if (!this._labelComponentMap) {
      this._labelComponentMap = new Map();
    }
    eachSeries(this._regions, (series: ISeries) => {
      const { markLabelSpec = {} } = series.getSpecInfo();
      const markNames = Object.keys(markLabelSpec);
      const region = series.getRegion();

      if (!this._labelInfoMap.get(region)) {
        this._labelInfoMap.set(region, []);
      }
      for (let i = 0; i < markNames.length; i++) {
        const markName = markNames[i];
        const mark = series.getMarkInName(markName);
        if (!mark) {
          continue;
        }
        markLabelSpec[markName as SeriesMarkNameEnum].forEach((spec: TransformedLabelSpec, index: number) => {
          if (spec.visible) {
            const info = this._labelInfoMap.get(region);
            const labelMark = this._createMark(
              {
                type: MarkTypeEnum.label,
                name: `${series.userId ?? series.id}-${markName}-label-${index}`
              },
              { attributeContext: series.getMarkAttributeContext() }
            ) as ILabelMark;
            if (spec.showRelatedMarkTooltip) {
              series.tooltipHelper?.activeTriggerSet.mark?.add(labelMark);
            }
            labelMark.setTarget(mark);
            info.push({
              labelMark,
              baseMark: mark,
              series,
              labelSpec: spec
            });
          }
        });
      }
    });
  }

  protected _initLabelComponent() {
    const removedComponents: Record<string, IComponentMark> = {};

    this._labelComponentMap.forEach((labelInfo, comp) => {
      removedComponents[comp.name] = comp;
    });

    this._labelInfoMap.forEach((regionLabelInfo, region) => {
      if (this._layoutRule === 'region') {
        let isNew = false;
        const labelName = `${region.getGroupMark().name}-label-component`;
        let component = removedComponents[labelName];

        if (!component) {
          isNew = true;
          component = this._createMark(
            { type: MarkTypeEnum.component, name: labelName },
            {
              componentType: 'label'
            },
            {
              support3d: (this._spec as any).support3d
            }
          );
        }
        if (component) {
          if (isNew) {
            component.setSkipBeforeLayouted(true);
            this._marks.addMark(component);

            // 当任意主图元数据更新的时候，都需要触发label的更新
            regionLabelInfo.forEach(labelInfo => {
              labelInfo.baseMark.getData()?.addRelatedMark(component);
            });
          }

          if (regionLabelInfo[0] && isValid(regionLabelInfo[0].labelSpec.zIndex)) {
            component.setMarkConfig({ zIndex: regionLabelInfo[0].labelSpec.zIndex });
          }
          this._labelComponentMap.set(component as IComponentMark, () => {
            return this._labelInfoMap.get(region);
          });
          removedComponents[labelName] = null;
        }
      } else {
        regionLabelInfo.forEach((labelInfo, i) => {
          let isNew = false;
          const labelName = `${labelInfo.labelMark.name}-component`;
          let component = removedComponents[labelName];
          if (!component) {
            isNew = true;
            component = this._createMark(
              { type: MarkTypeEnum.component, name: labelName },
              {
                componentType: 'label',
                noSeparateStyle: true
              },
              {
                support3d: labelInfo.baseMark.getMarkConfig().support3d
              }
            );
          }
          if (component) {
            if (isValid(labelInfo.labelSpec.zIndex)) {
              component.setMarkConfig({ zIndex: labelInfo.labelSpec.zIndex });
            }
            if (isNew) {
              component.setSkipBeforeLayouted(true);

              this._marks.addMark(component);
              // 当主图元数据更新的时候，都需要触发label的更新
              labelInfo.baseMark.getData()?.addRelatedMark(component);
            }
            this._labelComponentMap.set(component as IComponentMark, () => {
              return this._labelInfoMap.get(region)[i];
            });
            removedComponents[labelName] = null;
          }
        });
      }
    });

    Object.keys(removedComponents).forEach(name => {
      const comp = removedComponents[name];

      if (comp) {
        if (!comp.releaseWithExitAnimation()) {
          comp.release(); // todo 是否要上报
        }
        this._labelComponentMap.delete(comp);
      }
    });
  }

  protected _initTextMarkStyle() {
    this._labelComponentMap.forEach((labelInfoCb, labelComponent) => {
      const labelInfoArray = array(labelInfoCb());
      labelInfoArray.forEach(({ labelMark }) => {
        labelMark.setComponent(labelComponent);
      });
    });
    this._labelInfoMap.forEach(labelInfos => {
      labelInfos.forEach(info => {
        const { labelMark, labelSpec, series } = info;
        this.initMarkStyleWithSpec(labelMark, labelSpec);
        if (isFunction(labelSpec?.getStyleHandler)) {
          const styleHandler = labelSpec.getStyleHandler(series);
          styleHandler?.call(series, labelMark, labelSpec);
        }
        if (labelMark.stateStyle?.normal?.lineWidth) {
          labelMark.setAttribute('stroke', series.getColorAttribute(), 'normal', AttributeLevel.Base_Series);
        }
      });
    });
  }

  updateLayoutAttribute(): void {
    super.updateLayoutAttribute();
    this._labelComponentMap.forEach((labelInfoCb, labelComponent) => {
      const labelInfo = labelInfoCb();
      if (isArray(labelInfo)) {
        this._updateMultiLabelAttribute(labelInfo as ILabelInfo[], labelComponent);
      } else {
        this._updateSingleLabelAttribute(labelInfo as ILabelInfo, labelComponent);
      }
    });
  }

  protected _updateMultiLabelAttribute(labelInfo: ILabelInfo[], labelComponent: IComponentMark) {
    this._updateLabelComponentAttribute(
      labelComponent,
      labelInfo.map(({ baseMark }) => baseMark),
      labelInfo
    );
  }

  protected _updateSingleLabelAttribute(labelInfo: ILabelInfo, labelComponent: IComponentMark) {
    const { baseMark } = labelInfo;
    this._updateLabelComponentAttribute(labelComponent, baseMark, [labelInfo]);
  }

  protected _updateLabelComponentAttribute(
    labelComponent: IComponentMark,
    baseMark: IMark | IMark[],
    labelInfos: ILabelInfo[]
  ) {
    const totalLabels = this._option.getComponentsByType('totalLabel');

    labelComponent.setMarkConfig({
      interactive: false
    });

    labelComponent.setSimpleStyle({
      labelStyle: (labelIndex: number) => {
        const labelInfo = labelInfos[labelIndex];
        const { labelSpec, labelMark, series } = labelInfo;
        const rule = labelMark.getRule();
        const interactive = this._interactiveConfig(labelSpec);
        /** arc label When setting the centerOffset of the spec, the label also needs to be offset accordingly, and the centerOffset is not in the labelSpec */
        const centerOffset = (this._spec as any)?.centerOffset ?? 0;
        let spec = mergeSpec(
          {
            textStyle: { pickable: labelSpec.interactive === true, ...labelSpec.style },
            overlap: {
              avoidMarks: totalLabels.map(cmp => cmp.getMarks()[0].getProductId())
            }
          },
          defaultLabelConfig(rule, labelInfo),
          {
            ...pickWithout(labelSpec, ['position', 'style', 'state', 'type', 'stackDataFilterType', 'getStyleHandler']),
            ...interactive,
            centerOffset
          },
          labelSpec.stackDataFilterType
            ? {
                dataFilter:
                  labelSpec.stackDataFilterType === 'min'
                    ? (data: any) => {
                        return data.filter((d: any) => d.data[STACK_FIELD_TOTAL_BOTTOM]);
                      }
                    : (data: any) => {
                        return data.filter((d: any) => d.data[STACK_FIELD_TOTAL_TOP]);
                      }
              }
            : {}
        );

        if (series && series.parseLabelStyle) {
          spec = series.parseLabelStyle(spec, labelSpec, labelMark);
        }
        // TODO 可以优化。vgrammar 的 label 图元类型分发是完全依赖 baseMark 的类型。默认情况下，line/area 图元的标签会使用'line-data'标签，此时需要 vchart 将类型传给 vgrammar
        if (rule === 'line' || rule === 'area') {
          spec.type = rule;
        }

        return spec;
      },
      size: () => {
        return {
          padding: labelInfos[0].labelSpec.overlap?.padding,
          ...labelInfos[0].series.getRegion().getLayoutRect()
        };
      },
      itemEncoder: (datum: Datum, { labelIndex }: { labelIndex: number }) => {
        return labelInfos[labelIndex] && !labelInfos[labelIndex].labelMark.skipEncode
          ? textAttribute(
              labelInfos[labelIndex],
              datum,
              labelInfos[labelIndex].labelSpec.formatMethod,
              labelInfos[labelIndex].labelSpec.formatter
            )
          : { data: datum };
      }
    });

    this._setTransformOfComponent(labelComponent, baseMark);
  }

  compileMarks() {
    this.getMarks().forEach(m => {
      const labelInfo = this._labelComponentMap.get(m as IComponentMark)();
      let group;
      if (isArray(labelInfo)) {
        group = labelInfo[0].series.getRegion().getGroupMark().getProduct() as IGroup;
      } else {
        group = labelInfo.series.getRegion().getGroupMark().getProduct() as IGroup;
      }
      m.compile({ group });
    });
  }

  getLabelInfoByTextGraphic(text: IGraphic): ILabelInfo {
    let labelInfo: ILabelInfo;
    const vrenderLabel = text?.parent;
    const vrenderDataLabel = vrenderLabel?.parent;
    if (vrenderDataLabel) {
      const labelIndex = vrenderDataLabel.getChildren().indexOf(vrenderLabel as any);
      this._labelComponentMap.forEach((infoFunc, component) => {
        const graphicItem = component.getComponent();
        if (graphicItem === vrenderDataLabel) {
          labelInfo = array(infoFunc())[labelIndex];
        }
      });
    }
    return labelInfo;
  }
}

export const registerLabel = () => {
  Factory.registerGraphicComponent(Label.type, (attrs: DataLabelAttrs) => {
    return new DataLabel(attrs) as unknown as IGroup;
  });
  registerLabelMark();
  registerComponentMark();
  Factory.registerComponent(Label.type, Label, true, Infinity); // 标签组件最后创建
};
