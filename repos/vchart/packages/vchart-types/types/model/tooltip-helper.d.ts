import type { ITooltipSpec } from '../component/tooltip/interface';
import type { TooltipActiveType } from '../typings';
import type { IModel } from './interface';
import type { IMark } from '../mark/interface';
export type TooltipTrigger = IModel | IMark;
export interface ITooltipHelper {
    spec: ITooltipSpec | undefined;
    activeType: TooltipActiveType[];
    activeTriggerSet: {
        mark?: Set<TooltipTrigger>;
        group?: Set<TooltipTrigger>;
    };
    ignoreTriggerSet: {
        mark?: Set<TooltipTrigger>;
    };
    updateTooltipSpec: () => void;
}
export declare abstract class BaseTooltipHelper implements ITooltipHelper {
    spec: ITooltipSpec | undefined;
    activeType: TooltipActiveType[];
    activeTriggerSet: {
        mark: Set<TooltipTrigger>;
        group: Set<TooltipTrigger>;
    };
    ignoreTriggerSet: {
        mark: Set<TooltipTrigger>;
    };
    abstract updateTooltipSpec(): void;
}
