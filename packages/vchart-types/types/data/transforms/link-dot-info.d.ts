import type { Datum } from '../../typings';
export interface ILinkDotInfoOpt {
    infoKey: string;
    fields: () => {
        fromField: string;
        toField: string;
        xField: string | string[];
        yField: string | string[];
    };
    linkData: () => Datum[];
    dotData: () => Datum[];
}
export declare const linkDotInfo: (data: Array<DataView>, op: ILinkDotInfoOpt) => Datum[];
