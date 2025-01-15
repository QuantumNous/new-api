/**
 * @description table 菜单 panel tab 配置
 * @author lichunlin
 */

import Editor from '../../editor/index'
import { PanelConf, PanelTabConf } from '../menu-constructors/Panel'
import { getRandom } from '../../utils/util'
import $ from '../../utils/dom-core'
import '../../assets/style/create-panel-conf.less'
import CreateTable from './create-table'

/**
 * 判断一个数值是否为正整数
 * @param { number } n 被验证的值
 */
function isPositiveInteger(n: number): boolean {
    //是否为正整数
    return n > 0 && Number.isInteger(n)
}

export default function (editor: Editor): PanelConf {
    const createTable = new CreateTable(editor)

    // panel 中需要用到的id
    const colId = getRandom('w-col-id')
    const rowId = getRandom('w-row-id')
    const insertBtnId = getRandom('btn-link')

    const i18nPrefix = 'menus.panelMenus.table.'
    const t = (text: string): string => {
        return editor.i18next.t(text)
    }

    // tabs 配置 -----------------------------------------
    const tabsConf: PanelTabConf[] = [
        {
            title: t(`${i18nPrefix}插入表格`),
            tpl: `<div>
                    <div class="w-e-table">
                        <span>${t('创建')}</span>
                        <input id="${rowId}"  type="text" class="w-e-table-input" value="5"/></td>
                        <span>${t(`${i18nPrefix}行`)}</span>
                        <input id="${colId}" type="text" class="w-e-table-input" value="5"/></td>
                        <span>${
                            t(`${i18nPrefix}列`) + t(`${i18nPrefix}的`) + t(`${i18nPrefix}表格`)
                        }</span>
                    </div>
                    <div class="w-e-button-container">
                        <button type="button" id="${insertBtnId}" class="right">${t(
                '插入'
            )}</button>
                    </div>
                </div>`,
            events: [
                {
                    selector: '#' + insertBtnId,
                    type: 'click',
                    fn: () => {
                        const colValue = Number($('#' + colId).val())
                        const rowValue = Number($('#' + rowId).val())
                        //校验是否传值
                        if (isPositiveInteger(rowValue) && isPositiveInteger(colValue)) {
                            createTable.createAction(rowValue, colValue)
                            return true
                        } else {
                            editor.config.customAlert('表格行列请输入正整数', 'warning')
                            return false
                        }
                        // 返回 true 表示函数执行结束之后关闭 panel
                    },
                    bindEnter: true,
                },
            ],
        },
    ]
    // tabs end

    // 最终的配置 -----------------------------------------
    const conf: PanelConf = {
        width: 330,
        height: 0,
        tabs: [],
    }
    conf.tabs.push(tabsConf[0])

    return conf
}
