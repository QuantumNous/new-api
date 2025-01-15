/**
 * @description 历史记录 - 数据缓存的模式
 * @author fangzhicong
 */
/**
 * 是否为兼容模式。返回 true 表示当前使用兼容（内容备份）模式，否则使用标准（差异备份）模式
 */
declare function compatibleMode(): boolean;
declare const _default: {
    compatibleMode: typeof compatibleMode;
    historyMaxSize: number;
};
export default _default;
