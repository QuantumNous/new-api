import type { DataView } from '@visactor/vdataset';
import { GrammarItem } from '../grammar-item';
import type { Maybe } from '../../typings';
import type { ICompilableData } from './interface';
import type { GrammarItemInitOption } from '../interface';
import type { ICompilableMark } from '../mark';
export declare class CompilableData extends GrammarItem implements ICompilableData {
    protected _product: Maybe<any>;
    protected _prevProduct: Maybe<any>;
    getProduct(): any;
    protected _data: Maybe<DataView>;
    getDataView(): DataView;
    setDataView(d?: DataView): void;
    getLatestData(): any;
    constructor(option: GrammarItemInitOption, dataView?: DataView);
    removeProduct(_releaseDetach?: boolean): void;
    release(): void;
    protected _relatedMarks?: Record<string, ICompilableMark>;
    addRelatedMark(mark: ICompilableMark): void;
    updateData(noRender?: boolean): void;
    protected _compileProduct(): void;
    generateProductId(): string;
}
