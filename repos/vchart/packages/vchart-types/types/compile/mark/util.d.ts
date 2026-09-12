import type { IAttrs, IMarkStateStyle } from '../../mark/interface';
export declare function isAttrChangeable<T>(key: string, stateStyle: IMarkStateStyle<T>): boolean;
export declare function isStateAttrChangeable<T>(key: string, stateStyle: Partial<IAttrs<T>>, facetField: string): boolean;
export declare function stateInDefaultEnum(state: string): boolean;
export declare function stateToReverse(state: string): string;
