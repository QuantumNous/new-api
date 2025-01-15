import Editor from '../editor'
import { deepClone } from '../utils/util'

// 插件注册配置约束
export interface RegisterOptions {
    intention: any
    config?: any
    // example?: any // 原本是用来存放实例化后的插件对象的
}

// 插件列表类型
export type pluginsListType = {
    [key: string]: RegisterOptions
}

/**
 * 插件注册
 * @param { string } name 插件名
 * @param { RegisterOptions } options 插件配置
 * @param { pluginsListType } memory 存储介质
 */
export function registerPlugin(name: string, options: RegisterOptions, memory: pluginsListType) {
    if (!name) {
        throw new TypeError('name is not define')
    }

    if (!options) {
        throw new TypeError('options is not define')
    }

    if (!options.intention) {
        throw new TypeError('options.intention is not define')
    }

    if (options.intention && typeof options.intention !== 'function') {
        throw new TypeError('options.intention is not function')
    }

    if (memory[name]) {
        console.warn(`plugin ${name} 已存在，已覆盖。`)
    }

    memory[name] = options
}

/**
 * 插件初始化
 * @param { Editor } editor 编辑器实例
 */
export default function initPlugins(editor: Editor) {
    const plugins: pluginsListType = Object.assign(
        {},
        deepClone(Editor.globalPluginsFunctionList),
        deepClone(editor.pluginsFunctionList)
    )

    const values = Object.entries(plugins)
    values.forEach(([name, options]) => {
        console.info(`plugin ${name} initializing`)
        const { intention, config } = options
        intention(editor, config)
        console.info(`plugin ${name} initialization complete`)
    })
}
