import type { IInvalidType, StringOrNumber } from '../../typings';
export interface ITravelOpt {
    config: () => {
        invalidType: IInvalidType;
        checkField: StringOrNumber[];
    };
}
export declare const invalidTravel: (data: Array<any>, op: ITravelOpt) => any[];
