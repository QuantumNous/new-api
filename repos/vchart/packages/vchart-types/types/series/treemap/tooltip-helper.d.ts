import type { Datum } from '../../typings';
import { BaseSeriesTooltipHelper } from '../base/tooltip-helper';
import type { TreemapSeries } from './treemap';
export declare class TreemapTooltipHelper extends BaseSeriesTooltipHelper {
    series: TreemapSeries;
    get defaultShapeType(): string;
    markTooltipKeyCallback: (datum: Datum) => any;
    markTooltipValueCallback: (datum: Datum) => string | undefined;
    dimensionTooltipTitleCallback: (datum: Datum) => string | undefined;
}
