import type { Maybe } from '@visactor/vutils';
import type { ITooltipLineActual } from '../../../../../typings';
import type { ITooltipModelOption } from './interface';
export declare class BaseTooltipModel {
    static type: string;
    static isInstance(obj: any): obj is BaseTooltipModel;
    readonly type: string;
    readonly parent: BaseTooltipModel | HTMLElement;
    readonly childIndex: number;
    protected _option: ITooltipModelOption;
    setOption(option: ITooltipModelOption): void;
    protected _renderContentCache: ITooltipLineActual[] | null;
    children: Record<number, BaseTooltipModel>;
    product: Maybe<HTMLElement>;
    getParentEl(): HTMLElement;
    constructor(parent: BaseTooltipModel | HTMLElement, option: ITooltipModelOption, childIndex?: number);
    init(classList?: string[], id?: string): void;
    initAll(): void;
    setStyle(style?: Partial<CSSStyleDeclaration>): void;
    setContent(content?: any): void;
    setVisibility(visibility: boolean): void;
    getVisibility(): boolean;
    release(): void;
    protected createElement(tag: keyof HTMLElementTagNameMap, classList?: string[], style?: Partial<CSSStyleDeclaration>, id?: string): HTMLElement;
}
