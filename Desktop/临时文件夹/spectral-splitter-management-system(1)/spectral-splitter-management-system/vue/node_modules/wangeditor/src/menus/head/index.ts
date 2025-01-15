/**
 * @description 标题
 * @author wangfupeng
 */

import DropListMenu from '../menu-constructors/DropListMenu'
import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import { MenuActive } from '../menu-constructors/Menu'
import { getRandomCode } from '../../utils/util'
import { TCatalog } from '../../config/events'
import { EMPTY_P } from '../../utils/const'

class Head extends DropListMenu implements MenuActive {
    oldCatalogs: TCatalog[] | undefined
    constructor(editor: Editor) {
        const $elem = $(
            '<div class="w-e-menu" data-title="标题"><i class="w-e-icon-header"></i></div>'
        )
        const dropListConf = {
            width: 100,
            title: '设置标题',
            type: 'list', // droplist 以列表形式展示
            list: [
                { $elem: $('<h1>H1</h1>'), value: '<h1>' },
                { $elem: $('<h2>H2</h2>'), value: '<h2>' },
                { $elem: $('<h3>H3</h3>'), value: '<h3>' },
                { $elem: $('<h4>H4</h4>'), value: '<h4>' },
                { $elem: $('<h5>H5</h5>'), value: '<h5>' },
                {
                    $elem: $(`<p>${editor.i18next.t('menus.dropListMenu.head.正文')}</p>`),
                    value: '<p>',
                },
            ],
            clickHandler: (value: string) => {
                // 注意 this 是指向当前的 Head 对象
                this.command(value)
            },
        }
        super($elem, editor, dropListConf)

        const onCatalogChange = editor.config.onCatalogChange
        // 未配置目录change监听回调时不运行下面操作
        if (onCatalogChange) {
            this.oldCatalogs = []
            this.addListenerCatalog() // 监听文本框编辑时的大纲信息
            this.getCatalogs() // 初始有值的情况获取一遍大纲信息
        }
    }

    /**
     * 执行命令
     * @param value value
     */
    public command(value: string): void {
        const editor = this.editor
        const $selectionElem = editor.selection.getSelectionContainerElem()
        if ($selectionElem && editor.$textElem.equal($selectionElem)) {
            // 不能选中多行来设置标题，否则会出现问题
            // 例如选中的是 <p>xxx</p><p>yyy</p> 来设置标题，设置之后会成为 <h1>xxx<br>yyy</h1> 不符合预期
            this.setMultilineHead(value)
        } else {
            // 选中内容包含序列，code，表格，分割线时不处理
            if (
                ['OL', 'UL', 'LI', 'TABLE', 'TH', 'TR', 'CODE', 'HR'].indexOf(
                    $($selectionElem).getNodeName()
                ) > -1
            ) {
                return
            }

            editor.cmd.do('formatBlock', value)
        }

        // 标题设置成功且不是<p>正文标签就配置大纲id
        value !== '<p>' && this.addUidForSelectionElem()
    }

    /**
     * 为标题设置大纲
     */
    private addUidForSelectionElem() {
        const editor = this.editor
        const tag = editor.selection.getSelectionContainerElem()
        const id = getRandomCode() // 默认五位数id
        $(tag).attr('id', id)
    }

    /**
     * 监听change事件来返回大纲信息
     */
    private addListenerCatalog() {
        const editor = this.editor
        editor.txt.eventHooks.changeEvents.push(() => {
            this.getCatalogs()
        })
    }

    /**
     * 获取大纲数组
     */
    private getCatalogs() {
        const editor = this.editor
        const $textElem = this.editor.$textElem
        const onCatalogChange = editor.config.onCatalogChange
        const elems = $textElem.find('h1,h2,h3,h4,h5')
        const catalogs: TCatalog[] = []
        elems.forEach((elem, index) => {
            const $elem = $(elem)
            let id = $elem.attr('id')
            const tag = $elem.getNodeName()
            const text = $elem.text()
            if (!id) {
                id = getRandomCode()
                $elem.attr('id', id)
            }
            // 标题为空的情况不生成目录
            if (!text) return
            catalogs.push({
                tag,
                id,
                text,
            })
        })
        // 旧目录和新目录对比是否相等，不相等则运行回调并保存新目录到旧目录变量，以方便下一次对比
        if (JSON.stringify(this.oldCatalogs) !== JSON.stringify(catalogs)) {
            this.oldCatalogs = catalogs
            onCatalogChange && onCatalogChange(catalogs)
        }
    }
    /**
     * 设置选中的多行标题
     * @param value  需要执行的命令值
     */
    private setMultilineHead(value: string) {
        const editor = this.editor
        const $selection = editor.selection
        // 初始选区的父节点
        const containerElem = $selection.getSelectionContainerElem()?.elems[0]!
        // 白名单：用户选区里如果有该元素则不进行转换
        const _WHITE_LIST = [
            'IMG',
            'VIDEO',
            'TABLE',
            'TH',
            'TR',
            'UL',
            'OL',
            'PRE',
            'HR',
            'BLOCKQUOTE',
        ]
        // 获取选中的首、尾元素
        const startElem = $($selection.getSelectionStartElem())
        let endElem = $($selection.getSelectionEndElem())
        // 判断用户选中元素是否为最后一个空元素，如果是将endElem指向上一个元素
        if (
            endElem.elems[0].outerHTML === $(EMPTY_P).elems[0].outerHTML &&
            !endElem.elems[0].nextSibling
        ) {
            endElem = endElem.prev()!
        }
        // 存放选中的所有元素
        const cacheDomList: DomElement[] = []
        cacheDomList.push(startElem.getNodeTop(editor))
        // 选中首尾元素在父级下的坐标
        const indexList: number[] = []
        // 选区共同祖先元素的所有子节点
        const childList = $selection.getRange()?.commonAncestorContainer.childNodes
        // 找到选区的首尾元素的下标，方便最后恢复选区
        childList?.forEach((item, index) => {
            if (item === cacheDomList[0].getNode()) {
                indexList.push(index)
            }
            if (item === endElem.getNodeTop(editor).getNode()) {
                indexList.push(index)
            }
        })
        // 找到首尾元素中间所包含的所有dom
        let i = 0
        // 数组中的当前元素不等于选区最后一个节点时循环寻找中间节点
        while (cacheDomList[i].getNode() !== endElem.getNodeTop(editor).getNode()) {
            // 严谨性判断，是否元素为空
            if (!cacheDomList[i].elems[0]) return
            let d = $(cacheDomList[i].next().getNode())
            cacheDomList.push(d)
            i++
        }
        // 将选区内的所有子节点进行遍历生成对应的标签
        cacheDomList?.forEach((_node, index) => {
            // 判断元素是否含有白名单内的标签元素
            if (!this.hasTag(_node, _WHITE_LIST)) {
                const $h = $(value)
                const $parentNode = _node.parent().getNode()
                // 设置标签内容
                $h.html(`${_node.html()}`)
                // 插入生成的新标签
                $parentNode.insertBefore($h.getNode(), _node.getNode())
                // 移除原有的标签
                _node.remove()
            }
        })
        // 重新设置选区起始位置，保留拖蓝区域
        $selection.createRangeByElems(
            containerElem.children[indexList[0]],
            containerElem.children[indexList[1]]
        )
    }
    /**
     * 是否含有某元素
     * @param elem 需要检查的元素
     * @param whiteList 白名单
     */
    private hasTag(elem: DomElement, whiteList: string[]): boolean {
        if (!elem) return false
        if (whiteList.includes(elem?.getNodeName())) return true
        let _flag = false
        elem.children()?.forEach(child => {
            _flag = this.hasTag($(child), whiteList)
        })
        return _flag
    }
    /**
     * 尝试改变菜单激活（高亮）状态
     */
    public tryChangeActive() {
        const editor = this.editor
        const reg = /^h/i
        const cmdValue = editor.cmd.queryCommandValue('formatBlock')
        if (reg.test(cmdValue)) {
            this.active()
        } else {
            this.unActive()
        }
    }
}

export default Head
