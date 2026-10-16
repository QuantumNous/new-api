import { BaseComponent } from '../base/base-component';
import type { IComponentOption } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import { ComponentTypeEnum } from '../interface/type';
import type { IRegion } from '../../region/interface';
import type { IModelRenderOption } from '../../model/interface';
import { LayoutZIndex } from '../../constant/layout';
import type { ILabelSpec } from './interface';
import type { IHoverSpec, ISelectSpec } from '../../interaction/interface/spec';
import { array, isEqual, isNil, isPlainObject } from '@visactor/vutils';
import type { IGraphic } from '@visactor/vrender-core';
import type { IComponentMark } from '../../mark/interface/mark';
import type { ICompilableMark } from '../../compile/mark/interface';
import { DiffState } from '../../mark/interface/enum';
import type { Datum } from '../../typings/common';
import { MarkTypeEnum } from '../../mark/interface/type';
import type { IMark } from '../../mark/interface/common';
import { getActualColor } from '../../core';

export abstract class BaseLabelComponent<T = any> extends BaseComponent<T> {
  static type = ComponentTypeEnum.label;
  type = ComponentTypeEnum.label;
  name: string = ComponentTypeEnum.label;

  layoutType: 'none' = 'none';
  layoutZIndex: number = LayoutZIndex.Label;

  constructor(spec: T, options: IComponentOption) {
    super(spec, options);
    this._regions = options.getRegionsInIndex(options.regionIndexes);
  }

  protected _interactiveConfig(labelSpec: ILabelSpec) {
    const { interactive } = labelSpec;
    const result = { hover: false, select: false, state: labelSpec.state };
    if (interactive !== true) {
      return result;
    }

    const { hover, select } = this._option.getChart().getSpec();
    if (hover !== false || (hover as unknown as IHoverSpec).enable !== false) {
      result.hover = true;
    }
    if (select !== false || (select as unknown as ISelectSpec).enable !== false) {
      result.select = true;
    }
    return result;
  }

  /** Update API **/
  _compareSpec(spec: T, prevSpec: T) {
    const result = super._compareSpec(spec, prevSpec);
    result.reRender = true;
    if (!isEqual(prevSpec, spec)) {
      result.change = true;
      if (!result.reMake && !result.reCompile) {
        result.effects = {
          ...result.effects,
          component: true,
          layout: true,
          render: true
        };
      } else {
        result.reMake = true;
      }
    }

    return result;
  }

  _getDataLabelType(baseMark: ICompilableMark, type?: string) {
    const markType = baseMark.type;

    if (markType === 'line' || markType === 'area') {
      return type ?? 'line-data';
    }
    if (markType === MarkTypeEnum.rect) {
      return 'rect';
    }

    if (markType === MarkTypeEnum.arc) {
      return 'arc';
    }

    if (markType === MarkTypeEnum.symbol || markType === MarkTypeEnum.cell) {
      return 'symbol';
    }

    return baseMark.setDataLabelType ? baseMark.setDataLabelType() : '';
  }

  _setTransformOfComponent(labelComponent: IComponentMark, baseMark: IMark | IMark[]) {
    labelComponent.setAttributeTransform(({ labelStyle, size, itemEncoder }) => {
      const regionSize = size();
      const defaultFill = getActualColor({ type: 'palette', key: 'secondaryFontColor' }, this.getColorScheme());
      const dataLabels = array(baseMark).map((mark: IMark, labelIndex: number) => {
        const labelStyleRes = labelStyle(labelIndex);
        const labelData: any[] = [];
        const graphics = (mark as any).getGraphics();

        if (!graphics) {
          return;
        }

        if (labelStyleRes.data && labelStyleRes.data.length) {
          labelStyleRes.data.forEach((d: Datum, index: number) => {
            if (graphics[index]) {
              const formattedDatum = itemEncoder(d, { labelIndex });

              if (isNil(formattedDatum.fill)) {
                formattedDatum.fill = defaultFill;
              }
              if (isNil(formattedDatum.data)) {
                formattedDatum.data = d;
              }

              labelData.push(formattedDatum);
            }
          });
        } else {
          graphics.forEach((g: IGraphic) => {
            const { data, diffState } = g.context;

            if (diffState !== DiffState.exit) {
              data.forEach((datum: Datum, {}) => {
                const formattedDatum = itemEncoder(datum, { labelIndex });

                if (isNil(formattedDatum.fill)) {
                  formattedDatum.fill = defaultFill;
                }
                if (isNil(formattedDatum.data)) {
                  formattedDatum.data = datum;
                }

                labelData.push(formattedDatum);
              });
            }
          });
        }

        if (isPlainObject(labelStyleRes.overlap) && isNil(labelStyleRes.overlap.size)) {
          labelStyleRes.overlap.size = {
            ...regionSize
          };
        }

        return {
          smartInvert: false, // 之前在vgrammar 中设置的默认值
          baseMarkGroupName: mark.getProductId(),
          getBaseMarks: () => graphics,
          ...labelStyleRes,
          type: this._getDataLabelType(mark, labelStyleRes.type),
          data: labelData
        };
      });

      return {
        dataLabels,
        size: regionSize
      };
    });
  }

  getVRenderComponents() {
    const labels: any[] = [];
    this.getMarks().forEach(m => {
      const graphicItem = (m as IComponentMark).getComponent();
      if (graphicItem) {
        labels.push(graphicItem);
      }
    });
    return labels;
  }

  clear() {
    super.clear();

    this.getMarks().forEach(m => {
      if (m) {
        (m as IComponentMark).clearComponent();
      }
    });
  }
}
