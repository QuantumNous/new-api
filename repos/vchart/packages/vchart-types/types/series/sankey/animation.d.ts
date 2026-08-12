import type { ISankeyAnimationParams, SankeyAppearPreset } from './interface';
import type { IAnimationTypeConfig } from '../../animation/interface';
import { ACustomAnimate } from '@visactor/vrender-animate';
export declare const sankeyGrowIn: (params: ISankeyAnimationParams, isOverall?: boolean) => IAnimationTypeConfig;
export declare const sankeyGrowOut: (params: ISankeyAnimationParams, isOverall?: boolean) => IAnimationTypeConfig;
export declare const sankeyNodePresetAnimation: (params: ISankeyAnimationParams, preset: SankeyAppearPreset) => IAnimationTypeConfig;
export declare const sankeyLinkPresetAnimation: (preset: SankeyAppearPreset) => IAnimationTypeConfig;
export declare class LinkPathGrowIn extends ACustomAnimate<Record<string, number>> {
    onBind(): void;
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare class LinkPathGrowOut extends ACustomAnimate<Record<string, number>> {
    onBind(): void;
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare class LinkPathUpdate extends ACustomAnimate<Record<string, number>> {
    onBind(): void;
    onUpdate(end: boolean, ratio: number, out: Record<string, any>): void;
}
export declare const registerSankeyAnimation: () => void;
