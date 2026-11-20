import type { Functional } from '@visactor/vrender-components';
import type { ILabelSpec } from '../../component/label/interface';
import type { IMarkTheme } from '../../typings/spec/common';
import type { ILineMarkSpec, ISymbolMarkSpec } from '../../typings/visual';
export interface ILineLikeSeriesTheme {
    line?: Partial<IMarkTheme<ILineMarkSpec>>;
    point?: Partial<IMarkTheme<ISymbolMarkSpec>> & {
        visibleInActive?: boolean;
    };
    label?: Partial<ILineLikeLabelSpec>;
}
export type ILineLikeLabelSpec = Omit<ILabelSpec, 'position'> & {
    position?: Functional<'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center'>;
};
