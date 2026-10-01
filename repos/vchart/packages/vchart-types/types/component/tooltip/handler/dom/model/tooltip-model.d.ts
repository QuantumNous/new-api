import { BaseTooltipModel } from './base-tooltip-model';
import { ContentModel } from './content-model';
import type { ITooltipModelOption } from './interface';
import { TitleModel } from './title-model';
export declare class TooltipModel extends BaseTooltipModel {
    title: TitleModel | null;
    content: ContentModel | null;
    private _classList;
    private _id;
    constructor(parent: BaseTooltipModel | HTMLElement, option: ITooltipModelOption, classList: string[], id: string);
    setVisibility(visibility: boolean): void;
    init(): void;
    private _initPanel;
    private _initTitle;
    private _releaseTitle;
    private _initContent;
    private _releaseContent;
    setStyle(): void;
    setContent(): void;
    release(): void;
}
