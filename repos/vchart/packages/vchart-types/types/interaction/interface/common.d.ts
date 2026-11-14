import type { IMarkGraphic } from '../../mark/interface';
import type { RenderMode } from '../../typings/spec/common';
import type { IEventDispatcher } from '../../event/interface';
import type { IModel } from '../../model/interface';
import type { ITrigger } from './trigger';
export interface IInteraction {
    setDisableActiveEffect: (disable: boolean) => void;
    addTrigger: (trigger: ITrigger) => void;
    setStatedGraphics: (trigger: ITrigger, graphics: IMarkGraphic[]) => void;
    getStatedGraphics: (trigger: ITrigger) => IMarkGraphic[];
    updateStates: (trigger: ITrigger, newStatedGraphics: IMarkGraphic[], prevStatedGraphics?: IMarkGraphic[], state?: string, reverseState?: string) => IMarkGraphic[];
    clearAllStates: () => void;
    clearAllStatesOfTrigger: (trigger: ITrigger, state?: string, reverseState?: string) => void;
    clearByState: (stateValue: string) => any;
    updateStateOfGraphics: (stateValue: string, markGraphics: IMarkGraphic[]) => void;
}
export interface ITriggerOption {
    mode: RenderMode;
    interaction: IInteraction;
    eventDispatcher: IEventDispatcher;
    model: IModel;
}
