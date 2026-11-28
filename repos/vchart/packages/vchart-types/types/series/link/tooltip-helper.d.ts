import type { ISeriesTooltipHelper } from '../interface';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { ITooltipLinePattern, TooltipActiveType } from '../../typings';
export declare class LinkSeriesTooltipHelper extends BaseSeriesTooltipHelper implements ISeriesTooltipHelper {
    protected enableByType(activeType: TooltipActiveType): boolean;
    protected getDefaultTitlePattern(activeType: TooltipActiveType): ITooltipLinePattern;
    shapeTypeCallback: () => string;
    protected getDefaultContentList(): ITooltipLinePattern[];
}
