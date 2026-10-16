import type { ILayoutNumber, ILayoutPaddingSpec } from '../../../../typings/layout';
import type { ITick, IGrid } from '../../interface';
import type { ICartesianAxisUnit, ICartesianDomainLine, ICartesianLabel, ICartesianTitle } from './common';
import type { ICartesianAxisCommonSpec } from './spec';
export interface ICartesianAxisCommonTheme {
    grid?: IGrid;
    subGrid?: IGrid;
    domainLine?: ICartesianDomainLine;
    label?: ICartesianLabel;
    title?: ICartesianTitle;
    tick?: ITick;
    subTick?: ITick;
    background?: ICartesianAxisCommonSpec['background'];
    padding?: ILayoutPaddingSpec;
    width?: ILayoutNumber;
    maxWidth?: ILayoutNumber;
    minWidth?: ILayoutNumber;
    height?: ILayoutNumber;
    maxHeight?: ILayoutNumber;
    minHeight?: ILayoutNumber;
    unit?: ICartesianAxisUnit;
}
