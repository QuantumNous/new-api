import type { IMarkGraphic } from '../mark/interface';
import type { IInteraction } from './interface/common';
import type { ITrigger } from './interface/trigger';
export declare class Interaction implements IInteraction {
    private _stateGraphicsByTrigger;
    private _disableTriggerEvent;
    setDisableActiveEffect(disable: boolean): void;
    private _triggerMapByState;
    addTrigger(trigger: ITrigger): void;
    setStatedGraphics(trigger: ITrigger, graphics: IMarkGraphic[]): void;
    getStatedGraphics(trigger: ITrigger): IMarkGraphic[];
    updateStates(trigger: ITrigger, newStatedGraphics: IMarkGraphic[], prevStatedGraphics?: IMarkGraphic[], state?: string, reverseState?: string): IMarkGraphic[];
    protected toggleReverseStateOfGraphics(trigger: ITrigger, newStatedGraphics: IMarkGraphic[], prevStatedGraphics: IMarkGraphic[], reverseState: string): void;
    protected toggleStateOfGraphics(trigger: ITrigger, newStatedGraphics: IMarkGraphic[], prevStatedGraphics: IMarkGraphic[], state: string): void;
    protected addBothStateOfGraphics(trigger: ITrigger, statedGraphics: IMarkGraphic[], state: string, reverseState: string): void;
    protected addStateOfGraphics(trigger: ITrigger, statedGraphics: IMarkGraphic[], state: string): void;
    clearAllStatesOfTrigger(trigger: ITrigger, state?: string, reverseState?: string): void;
    clearAllStates(): void;
    clearByState(stateValue: string): void;
    updateStateOfGraphics(stateValue: string, markGraphics: IMarkGraphic[]): void;
}
