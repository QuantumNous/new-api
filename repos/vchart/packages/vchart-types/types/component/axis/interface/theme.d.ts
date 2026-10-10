import type { IDomainLine, IGrid, ILabel, ISubTick, ITick, ITitle } from './spec';
export interface IAxisCommonTheme {
    grid?: IGrid;
    subGrid?: IGrid;
    domainLine?: IDomainLine;
    label?: ILabel;
    title?: ITitle;
    tick?: ITick;
    subTick?: ISubTick;
}
export interface IBandAxisTheme extends IAxisCommonTheme {
    bandPadding?: number | number[];
    paddingInner?: number | number[];
    paddingOuter?: number | number[];
}
