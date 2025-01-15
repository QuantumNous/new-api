/**
 * @description  表情菜单 panel配置
 * @author liuwei
 */

import Editor from '../../editor/index'
import { PanelConf, PanelTabConf } from '../menu-constructors/Panel'
import $ from '../../utils/dom-core'
import { EmotionsType, EmotionsContentType } from '../../config/menus'

export default function (editor: Editor): PanelConf {
    // 声明emotions数据结构
    const emotions: Array<EmotionsType> = editor.config.emotions

    /* tabs配置项 ==================================================================*/

    // 生成表情结构 TODO jele type类型待优化
    function GenerateExpressionStructure(ele: EmotionsType) {
        // 返回为一个数组对象
        let res: string[] = []

        // 如果type是image类型则生成一个img标签
        if (ele.type == 'image') {
            res = ele.content.map((con: EmotionsContentType | string) => {
                if (typeof con == 'string') return ''
                return `<span  title="${con.alt}">
                    <img class="eleImg" data-emoji="${con.alt}" style src="${con.src}" alt="[${con.alt}]">
                </span>`
            })
            res = res.filter((s: string) => s !== '')
        }
        //否则直接当内容处理
        else {
            res = ele.content.map((con: EmotionsContentType | string) => {
                return `<span class="eleImg" title="${con}">${con}</span>`
            })
        }

        return res.join('').replace(/&nbsp;/g, '')
    }

    const tabsConf: PanelTabConf[] = emotions.map((ele: EmotionsType) => {
        return {
            title: editor.i18next.t(`menus.panelMenus.emoticon.${ele.title}`),

            // 判断type类型如果是image则以img的形式插入否则以内容
            tpl: `<div>${GenerateExpressionStructure(ele)}</div>`,

            events: [
                {
                    selector: '.eleImg',
                    type: 'click',
                    fn: (e: Event) => {
                        // e为事件对象
                        const $target = $(e.target)
                        const nodeName = $target.getNodeName()
                        let insertHtml

                        if (nodeName === 'IMG') {
                            // 插入图片
                            insertHtml = $target.parent().html().trim()
                        } else {
                            // 插入 emoji
                            insertHtml = '<span>' + $target.html() + '</span>'
                        }

                        editor.cmd.do('insertHTML', insertHtml)
                        // 示函数执行结束之后关闭 panel
                        return true
                    },
                },
            ],
        }
    })
    /* tabs配置项 =================================================================end*/

    // 最终的配置 -----------------------------------------
    const conf: PanelConf = {
        width: 300, // Panel容器宽度
        height: 230, // Panel容器高度
        tabs: tabsConf,
    }
    return conf
}
