/* eslint-disable no-duplicate-imports */
import { isArray, isEmpty, isNil } from '@visactor/vutils';
import type { DataSet, DataView } from '@visactor/vdataset';

import type { DrillInfo } from '../../data/transforms/drill';
import { drillFilter, DrillEnum } from '../../data/transforms/drill';
import type { EventType, IEvent } from '../../event/interface';
import type { RenderMode } from '../../typings/spec';
import { getDefaultTriggerEventByMode } from '../../component/common/trigger/config';
import { findHierarchyPath } from '../../util/hierarchy';
import { ChartEvent } from '../../constant/event';
import { registerDataSetInstanceTransform } from '../../data/register';
import type { IModel } from '../../model/interface';
import type { BaseSeries } from '../../series/base/base-series';
import { ComponentTypeEnum } from '../../component/interface/type';
import type { Tooltip } from '../../component/tooltip';

interface DrillParams {
  event: IEvent;
  mode: RenderMode;
  drillField: () => string;
  getRawData: () => DataView;
}

export interface IDrillable {
  /**
   * 初始化钻取设置
   */
  initDrillable: (params: DrillParams) => void;

  /**
   * 初始化钻取数据
   */
  initDrillableData: (dataSet: DataSet) => void;

  /**
   * 绑定钻取事件
   */
  bindDrillEvent: () => void;

  /**
   * 上卷
   */
  drillUp: () => void;

  /**
   * 下钻
   * @param drillPath 钻取路径
   */
  drillDown: (drillPath: string[]) => string[];
}

export class Drillable implements IDrillable {
  private _drillParams: DrillParams;
  private _drillInfo: DrillInfo;

  private _getDrillTriggerEvent(type: string): EventType {
    const { mode } = this._drillParams;

    return getDefaultTriggerEventByMode(mode)?.[type];
  }

  private _hideTooltip() {
    const tooltip = (this as unknown as BaseSeries<null>)
      .getChart()
      .getComponentsByType(ComponentTypeEnum.tooltip)[0] as Tooltip;
    tooltip && tooltip.hideTooltip();
  }

  initDrillable(params: DrillParams) {
    this._drillParams = params;
  }

  initDrillableData(dataSet: DataSet) {
    const { getRawData } = this._drillParams;
    // 注册筛选方法
    registerDataSetInstanceTransform(dataSet, 'drillFilter', drillFilter);

    // 调用筛选数据, 用于上卷下钻
    getRawData().transform({
      type: 'drillFilter',
      options: {
        info: () => this._drillInfo,
        keyField: () => this._drillParams.drillField()
      }
    });
  }

  bindDrillEvent() {
    const { event, getRawData, drillField } = this._drillParams;
    const keyField = drillField();
    if (this._getDrillTriggerEvent('start')) {
      event.on(this._getDrillTriggerEvent('start'), e => {
        if (isNil(e.datum) || isNil(e.datum?.[keyField])) {
          this.drillUp();
          return;
        }

        // Drill交互后, 隐藏Tooltip
        this._hideTooltip();
        // 获取数据key
        const dataKey = e.datum[keyField];
        // 已钻取的路径
        const selectPath = this._drillInfo?.path ?? [];
        // 用户点击的路径
        const clickedPath = findHierarchyPath(getRawData().rawData, dataKey, keyField, 'children');
        // 已钻取过, 则一定上卷
        if (selectPath[selectPath.length - 1] === clickedPath[clickedPath.length - 1]) {
          this.drillUp();
        } else {
          this.drillDown(clickedPath);
        }
      });
    }
  }

  /**
   * 下钻接口
   * @param drillPath 下钻后的路径
   * @returns 当然路径
   * @description 根据传入的path, 向指定层级下钻.
   */
  drillDown(drillPath: string[] = []): string[] {
    const { getRawData, event } = this._drillParams;
    if (!isArray(drillPath) || isEmpty(drillPath)) {
      return drillPath;
    }

    // 根据钻取路径, 获得当前需要展示的层级
    const dataKey = drillPath[drillPath.length - 1];

    this._drillInfo = {
      key: dataKey,
      path: drillPath,
      type: DrillEnum.DrillDown
    };

    getRawData().reRunAllTransform();
    event.emit(ChartEvent.drill, {
      value: { path: drillPath, type: DrillEnum.DrillDown },
      model: this as unknown as IModel
    });
    return drillPath;
  }

  /**
   * 上卷接口
   * @returns 上卷后的路径
   * @description 根据path信息, 向父层级上卷.
   */
  drillUp() {
    const { getRawData, event } = this._drillParams;

    const path = this._drillInfo?.path ?? [];
    if (!isArray(path) || isEmpty(path)) {
      return path;
    }

    const dataKey = path.pop();

    this._drillInfo = {
      key: dataKey,
      path: path,
      type: DrillEnum.DrillUp
    };

    getRawData().reRunAllTransform();
    event.emit(ChartEvent.drill, {
      value: { path, type: DrillEnum.DrillUp },
      model: this as unknown as IModel
    });
    return path;
  }
}
