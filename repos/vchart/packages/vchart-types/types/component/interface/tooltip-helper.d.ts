import type { ITooltipHelper } from '../../model/tooltip-helper';
import type { IComponent } from './common';
export interface IComponentTooltipHelper extends ITooltipHelper {
    component: IComponent;
}
