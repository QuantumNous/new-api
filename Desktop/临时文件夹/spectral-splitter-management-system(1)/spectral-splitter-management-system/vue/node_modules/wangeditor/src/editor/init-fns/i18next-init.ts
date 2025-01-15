/**
 * @description 国际化 初始化
 * @author tonghan
 * i18next 是使用 JavaScript 编写的国际化框架
 * i18next 提供了标准的i18n功能，例如（复数，上下文，插值，格式）等
 * i18next 文档地址： https://www.i18next.com/overview/getting-started
 */

import Editor from '../index'

function i18nextInit(editor: Editor) {
    const { lang, languages } = editor.config

    if (editor.i18next != null) {
        try {
            editor.i18next.init({
                ns: 'wangEditor',
                lng: lang,
                defaultNS: 'wangEditor',
                resources: languages,
            })
        } catch (error) {
            throw new Error('i18next:' + error)
        }
        return
    }

    // 没有引入 i18next 的替代品
    editor.i18next = {
        t(str: string) {
            const strArr = str.split('.')
            return strArr[strArr.length - 1]
        },
    }
}

export default i18nextInit
