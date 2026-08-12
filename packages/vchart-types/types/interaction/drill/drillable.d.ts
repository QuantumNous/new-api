import type { DataSet, DataView } from '@visactor/vdataset';
import type { IEvent } from '../../event/interface';
import type { RenderMode } from '../../typings/spec';
interface DrillParams {
    event: IEvent;
    mode: RenderMode;
    drillField: () => string;
    getRawData: () => DataView;
}
export interface IDrillable {
    initDrillable: (params: DrillParams) => void;
    initDrillableData: (dataSet: DataSet) => void;
    bindDrillEvent: () => void;
    drillUp: () => void;
    drillDown: (drillPath: string[]) => string[];
}
export declare class Drillable implements IDrillable {
    private _drillParams;
    private _drillInfo;
    private _getDrillTriggerEvent;
    private _hideTooltip;
    initDrillable(params: DrillParams): void;
    initDrillableData(dataSet: DataSet): void;
    bindDrillEvent(): void;
    drillDown(drillPath?: string[]): string[];
    drillUp(): string[];
}
export {};
