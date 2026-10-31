import type { IMarkArea, IMarkAreaSpec } from './interface';
import {
  computeClipRange,
  transformLabelAttributes,
  transformState,
  transformStyle,
  getMarkAreaProcessInfo
} from '../utils';
import type { MarkArcAreaAttrs, MarkAreaAttrs } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import type { MarkArea as MarkAreaComponent, MarkArcArea as MarkArcAreaComponent } from '@visactor/vrender-components';
import { transformToGraphic } from '../../../util/style';
import { BaseMarker } from '../base-marker';
import { LayoutZIndex } from '../../../constant/layout';
import type { IGroup } from '@visactor/vrender-core';
import { array } from '@visactor/vutils';
export abstract class BaseMarkArea extends BaseMarker<IMarkAreaSpec> implements IMarkArea {
  static specKey = 'markArea';
  specKey = 'markArea';

  layoutZIndex: number = LayoutZIndex.MarkArea;

  // eslint-disable-next-line max-len
  protected abstract _newMarkAreaComponent(
    attr: MarkAreaAttrs | MarkArcAreaAttrs
  ): MarkAreaComponent | MarkArcAreaComponent;
  protected abstract _computePointsAttr(): any;

  static _getMarkerCoordinateType(markerSpec: any): string {
    const { doAngleProcess, doRadiusProcess, doRadAngProcess } = getMarkAreaProcessInfo(markerSpec);

    if (markerSpec.coordinateType === 'polar' || doAngleProcess || doRadiusProcess || doRadAngProcess) {
      return 'polar';
    }
    return 'cartesian';
  }

  protected _createMarkerComponent() {
    const label = array(this._spec.label ?? {});
    const markAreaAttrs: MarkAreaAttrs | MarkArcAreaAttrs = {
      zIndex: this.layoutZIndex,
      interactive: this._spec.interactive ?? true,
      hover: this._spec.interactive ?? true,
      select: this._spec.interactive ?? true,
      points: [
        {
          x: 0,
          y: 0
        }
      ],
      center: {
        x: 0,
        y: 0
      },
      innerRadius: 0,
      outerRadius: 0,
      startAngle: 0,
      endAngle: 0,
      areaStyle: transformStyle(
        transformToGraphic(this._spec.area?.style),
        this._markerData,
        this._markAttributeContext
      ),
      clipInRange: this._spec.clip ?? false,
      label: label.map((labelItem: any) => {
        return transformLabelAttributes(labelItem, this._markerData, this._markAttributeContext);
      }),
      state: {
        area: transformState(this._spec.area?.state, this._markerData, this._markAttributeContext),
        label: label.map((labelItem: any) => {
          return transformState(labelItem.state, this._markerData, this._markAttributeContext);
        }),
        labelBackground: label.map((labelItem: any) => {
          return transformState(labelItem.labelBackground?.state, this._markerData, this._markAttributeContext);
        })
      },
      animation: this._spec.animation ?? false,
      animationEnter: this._spec.animationEnter,
      animationExit: this._spec.animationExit,
      animationUpdate: this._spec.animationUpdate
    };

    const markArea = this._newMarkAreaComponent(markAreaAttrs);
    return markArea as unknown as IGroup;
  }

  protected _markerLayout() {
    const spec = this._spec as any;
    const data = this._markerData;
    const startRelativeSeries = this._startRelativeSeries;
    const endRelativeSeries = this._endRelativeSeries;
    const relativeSeries = this._relativeSeries;

    const pointsAttr = this._computePointsAttr();

    const seriesData = this._getRelativeDataView().latestData;
    const dataPoints = data
      ? data.latestData[0] && data.latestData[0].latestData
        ? data.latestData[0].latestData
        : data.latestData
      : seriesData;

    let limitRect;
    if (spec.clip || array(spec.label).some(labelCfg => labelCfg?.confine)) {
      const { minX, maxX, minY, maxY } = computeClipRange([
        startRelativeSeries.getRegion(),
        endRelativeSeries.getRegion(),
        relativeSeries.getRegion()
      ]);
      limitRect = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }

    if (this._markerComponent) {
      const prevLabelAttrs = array(this._markerComponent.attribute?.label);
      const specLabels = array(this._spec.label);

      this._markerComponent.setAttributes({
        ...pointsAttr,
        label: prevLabelAttrs.map((prevLabel, index) => {
          const specLabel = specLabels[index] || {};
          return {
            ...prevLabel,
            text: specLabel.formatMethod
              ? // type error here will be fixed in components
                (specLabel.formatMethod(dataPoints, seriesData) as any)
              : prevLabel?.text
          };
        }),
        limitRect,
        dx: this._layoutOffsetX,
        dy: this._layoutOffsetY
      } as any);
    }
  }

  protected _initDataView(): void {
    const spec = this._spec as any;
    const {
      doXProcess,
      doYProcess,
      doXYProcess,
      doAngleProcess,
      doRadiusProcess,
      doRadAngProcess,
      doCoordinatesProcess
    } = getMarkAreaProcessInfo(spec);
    if (
      !doXProcess &&
      !doYProcess &&
      !doXYProcess &&
      !doAngleProcess &&
      !doRadiusProcess &&
      !doRadAngProcess &&
      !doCoordinatesProcess
    ) {
      return null;
    }

    this._initCommonDataView();
  }
}
