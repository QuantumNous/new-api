import Editor from '../editor';
export interface RegisterOptions {
    intention: any;
    config?: any;
}
export declare type pluginsListType = {
    [key: string]: RegisterOptions;
};
/**
 * 插件注册
 * @param { string } name 插件名
 * @param { RegisterOptions } options 插件配置
 * @param { pluginsListType } memory 存储介质
 */
export declare function registerPlugin(name: string, options: RegisterOptions, memory: pluginsListType): void;
/**
 * 插件初始化
 * @param { Editor } editor 编辑器实例
 */
export default function initPlugins(editor: Editor): void;
