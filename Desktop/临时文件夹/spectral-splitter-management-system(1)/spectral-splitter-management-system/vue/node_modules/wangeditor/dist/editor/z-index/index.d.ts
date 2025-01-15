/**
 * @description z-index 管理器
 * @author fangzhicong
 */
import Editor from '../index';
declare const tier: {
    menu: number;
    panel: number;
    toolbar: number;
    tooltip: number;
    textContainer: number;
};
declare type Tier = typeof tier;
declare type TierKey = keyof Tier;
export default class ZIndex {
    private tier;
    private baseZIndex;
    get(tierName?: TierKey): number;
    init(editor: Editor): void;
}
export {};
