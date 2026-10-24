import type { IMark } from '../interface';
export interface IMarkInfo {
    styleWithSeriesField?: boolean;
    name?: string;
}
export declare class MarkSet {
    protected _children: IMark[];
    protected _markNameMap: Record<string, IMark>;
    getMarkNameMap(): Record<string, IMark>;
    protected readonly _infoMap: Map<IMark, IMarkInfo>;
    static readonly defaultMarkInfo: IMarkInfo;
    addMark(mark?: IMark, markInfo?: IMarkInfo): void;
    removeMark(markName: string): void;
    clear(): void;
    forEach(callbackfn: (value: IMark, index: number, array: IMark[]) => void): void;
    includes(mark: IMark, fromIndex?: number): boolean;
    get(key: number | string): any;
    getMarks(): IMark[];
    getMarksInType(type: string | string[]): IMark[];
    getMarkInId(markId: number): IMark | undefined;
    getMarkWithInfo(info: Partial<IMarkInfo>): IMark;
}
