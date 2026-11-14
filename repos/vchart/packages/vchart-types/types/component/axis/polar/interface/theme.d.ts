import type { IDomainLine, ITick, ITitle, ILabel } from '../../interface';
import type { IPolarGrid } from './common';
export interface IPolarAxisCommonTheme {
    grid?: IPolarGrid;
    subGrid?: IPolarGrid;
    domainLine?: IDomainLine;
    label?: ILabel;
    title?: ITitle;
    tick?: ITick;
    subTick?: ITick;
}
