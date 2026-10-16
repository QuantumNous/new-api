import { BaseTooltipModel } from './base-tooltip-model';
export declare class TextModel extends BaseTooltipModel {
    init(classList?: string[], id?: string, tag?: keyof HTMLElementTagNameMap): void;
    setContent(content?: any, multiLine?: boolean): void;
}
