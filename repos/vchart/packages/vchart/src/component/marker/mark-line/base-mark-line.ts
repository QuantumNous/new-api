import { DataView } from '@visactor/vdataset';
import type { IMarkLine, IMarkLineSpec } from './interface';
import { markerAggregation } from '../../../data/transforms/aggregation';
import {
  computeClipRange,
  transformLabelAttributes,
  transformState,
  transformStyle,
  getMarkLineProcessInfo
} from '../utils';
import { registerDataSetInstanceTransform } from '../../../data/register';
import type { MarkArcLineAttrs, MarkLineAttrs } from '@visactor/vrender-components';
// eslint-disable-next-line no-duplicate-imports
import type { MarkLine as MarkLineComponent, MarkArcLine as MarkArcLineComponent } from '@visactor/vrender-components';
import { transformToGraphic } from '../../../util/style';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
import type { IMarkerSymbol } from '../interface';
import { markerRegression } from '../../../data/transforms/regression';
import { LayoutZIndex } from '../../../constant/layout';
import { markerFilter } from '../../../data/transforms/marker-filter';
import { array } from '@visactor/vutils';

export abstract class BaseMarkLine extends BaseMarker<IMarkLineSpec> implements IMarkLine {
  static specKey = 'markLine';
  specKey = 'markLine';
  layoutZIndex: number = LayoutZIndex.MarkLine;

  // eslint-disable-next-line max-len
  protected abstract _newMarkLineComponent(
    attr: MarkLineAttrs | MarkArcLineAttrs
  ): MarkLineComponent | MarkArcLineComponent;
  protected abstract _computePointsAttr(): any;

  static _getMarkerCoordinateType(markerSpec: any): string {
    const { doAngleProcess, doRadiusProcess, doAngRadRad1Process, doRadAngAng1Process, doRadAngProcess } =
      getMarkLineProcessInfo(markerSpec);

    if (
      markerSpec.coordinateType === 'polar' ||
      doAngleProcess ||
      doRadiusProcess ||
      doAngRadRad1Process ||
      doRadAngAng1Process ||
      doRadAngProcess
    ) {
      return 'polar';
    }
    return 'cartesian';
  }

  protected _createMarkerComponent() {
    const { startSymbol = {} as IMarkerSymbol, endSymbol = {} as IMarkerSymbol } = this._spec as IMarkLineSpec;
    const label = array(this._spec.label ?? {});

    const markLineAttrs: MarkLineAttrs | MarkArcLineAttrs = {
      zIndex: this.layoutZIndex,
      interactive: this._spec.interactive ?? true,
      hover: this._spec.interactive ?? true,
      select: this._spec.interactive ?? true,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ],
      center: {
        x: 0,
        y: 0
      },
      radius: 0,
      startAngle: 0,
      endAngle: 0,
      lineStyle: transformStyle(
        transformToGraphic(this._spec.line?.style),
        this._markerData,
        this._markAttributeContext
      ),
      clipInRange: this._spec.clip ?? false,
      label: label.map(labelItem => {
        return transformLabelAttributes(labelItem, this._markerData, this._markAttributeContext);
      }),
      state: {
        line: transformState(this._spec.line?.state ?? {}, this._markerData, this._markAttributeContext),
        lineStartSymbol: transformState(
          this._spec.startSymbol?.state ?? {},
          this._markerData,
          this._markAttributeContext
        ),
        lineEndSymbol: transformState(this._spec.endSymbol?.state ?? {}, this._markerData, this._markAttributeContext),
        label: label.map(labelItem => {
          return transformState(labelItem.state ?? {}, this._markerData, this._markAttributeContext);
        }),
        labelBackground: label.map(labelItem => {
          return transformState(labelItem.labelBackground?.state ?? {}, this._markerData, this._markAttributeContext);
        })
      },
      animation: this._spec.animation ?? false,
      animationEnter: this._spec.animationEnter,
      animationExit: this._spec.animationExit,
      animationUpdate: this._spec.animationUpdate
    };

    if (startSymbol.visible) {
      markLineAttrs.startSymbol = {
        ...startSymbol,
        visible: true,
        style: transformStyle(transformToGraphic(startSymbol.style), this._markerData, this._markAttributeContext)
      };
    } else {
      markLineAttrs.startSymbol = {
        visible: false
      };
    }

    if (endSymbol.visible) {
      markLineAttrs.endSymbol = {
        ...endSymbol,
        visible: true,
        style: transformStyle(transformToGraphic(endSymbol.style), this._markerData, this._markAttributeContext)
      };
    } else {
      markLineAttrs.endSymbol = {
        visible: false
      };
    }
    const markLine = this._newMarkLineComponent(markLineAttrs);
    return markLine as unknown as IGroup;
  }

  protected _getUpdateMarkerAttrs() {
    const spec = this._spec;
    const data = this._markerData;
    const startRelativeSeries = this._startRelativeSeries;
    const endRelativeSeries = this._endRelativeSeries;
    const relativeSeries = this._relativeSeries;

    const pointsAttr = this._computePointsAttr();

    const seriesData = relativeSeries.getViewData().latestData;
    const dataPoints =
      data.latestData[0] && data.latestData[0].latestData ? data.latestData[0].latestData : data.latestData;

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
    const markerComponentAttr = this._markerComponent?.attribute ?? {};
    const prevLabelAttrs = array(markerComponentAttr.label);
    const specLabels = array(this._spec.label);

    const labelAttrs = prevLabelAttrs.map((prevLabel, index) => {
      const specLabel = specLabels[index] || {};
      return {
        ...prevLabel,
        text: specLabel.formatMethod ? (specLabel.formatMethod(dataPoints, seriesData) as any) : prevLabel?.text
      };
    });
    return {
      ...pointsAttr,
      label: labelAttrs as MarkLineComponent['attribute']['label'],
      limitRect,
      dx: this._layoutOffsetX,
      dy: this._layoutOffsetY
    };
  }

  protected _markerLayout() {
    const updateAttrs = this._getUpdateMarkerAttrs();
    this._markerComponent?.setAttributes(updateAttrs);
  }

  protected _initDataView(): void {
    const spec = this._spec;
    const isCoordinateProcess = 'coordinates' in spec;

    const {
      doXProcess,
      doYProcess,
      doXYY1Process,
      doYXX1Process,
      doXYProcess,
      doAngleProcess,
      doRadiusProcess,
      doAngRadRad1Process,
      doRadAngAng1Process,
      doRadAngProcess
    } = getMarkLineProcessInfo(spec);
    this._setMarkerData(this._getRelativeDataView());

    if (
      !doXProcess &&
      !doYProcess &&
      !doXYY1Process &&
      !doYXX1Process &&
      !doXYProcess &&
      !doAngleProcess &&
      !doRadiusProcess &&
      !doAngRadRad1Process &&
      !doRadAngAng1Process &&
      !doRadAngProcess &&
      !isCoordinateProcess
    ) {
      return;
    }

    registerDataSetInstanceTransform(this._option.dataSet, 'markerAggregation', markerAggregation);
    registerDataSetInstanceTransform(this._option.dataSet, 'markerRegression', markerRegression);
    registerDataSetInstanceTransform(this._option.dataSet, 'markerFilter', markerFilter);

    const { options, needAggr, needRegr, processData } = this._computeOptions();

    const data = new DataView(this._option.dataSet);
    data.parse([processData], {
      type: 'dataview'
    });
    if (needAggr) {
      data.transform({
        type: 'markerAggregation',
        options
      });
    }
    if (needRegr) {
      data.transform({
        type: 'markerRegression',
        options
      });
    }

    data.transform({
      type: 'markerFilter',
      options: this._getAllRelativeSeries()
    });

    this._setMarkerData(data, true);
    this._bindMarkerDataChange();
  }
}
