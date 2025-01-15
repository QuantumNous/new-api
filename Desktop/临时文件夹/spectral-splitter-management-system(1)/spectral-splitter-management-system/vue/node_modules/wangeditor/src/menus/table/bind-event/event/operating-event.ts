import $, { DomElement } from '../../../../utils/dom-core'

/**
 * 处理新添加行
 * @param $node 整个table
 * @param _index 行的inde
 */
function ProcessingRow($node: DomElement, _index: number): DomElement {
    //执行获取tbody节点
    let $dom = generateDomAction($node)
    //取出所有的行
    let domArray: HTMLElement[] = Array.prototype.slice.apply($dom.children)
    //列的数量
    const childrenLength = domArray[0].children.length
    //创建新tr
    let tr = document.createElement('tr')
    for (let i = 0; i < childrenLength; i++) {
        const td = document.createElement('td')
        tr.appendChild(td)
    }
    //插入集合中
    domArray.splice(_index + 1, 0, tr)
    //移除、新增节点事件
    removeAndInsertAction($dom, domArray)
    return $($dom.parentNode)
}

/**
 * 处理新添加列
 * @param $node 整个table
 * @param _index 列的inde
 */
function ProcessingCol($node: DomElement, _index: number): DomElement {
    //执行获取tbody节点
    let $dom = generateDomAction($node)
    //取出所有的行
    let domArray: HTMLElement[] = Array.prototype.slice.apply($dom.children)
    //创建td
    for (let i = 0; i < domArray.length; i++) {
        let cArray: Node[] = []
        //取出所有的列
        Array.from(domArray[i].children).forEach(item => {
            cArray.push(item)
        })
        //移除行的旧的子节点
        while (domArray[i].children.length !== 0) {
            domArray[i].removeChild(domArray[i].children[0])
        }
        //列分th td
        let td =
            $(cArray[0]).getNodeName() !== 'TH'
                ? document.createElement('td')
                : document.createElement('th')
        // let td = document.createElement('td')
        cArray.splice(_index + 1, 0, td)
        //插入新的子节点
        for (let j = 0; j < cArray.length; j++) {
            domArray[i].appendChild(cArray[j])
        }
    }
    //移除、新增节点事件
    removeAndInsertAction($dom, domArray)
    return $($dom.parentNode)
}

/**
 * 处理删除行
 * @param $node  整个table
 * @param _index  行的inde
 */
function DeleteRow($node: DomElement, _index: number): DomElement {
    //执行获取tbody节点
    let $dom = generateDomAction($node)
    //取出所有的行
    let domArray: HTMLElement[] = Array.prototype.slice.apply($dom.children)
    //删除行
    domArray.splice(_index, 1)
    //移除、新增节点事件
    removeAndInsertAction($dom, domArray)
    return $($dom.parentNode)
}

/**
 * 处理删除列
 * @param $node
 * @param _index
 */
function DeleteCol($node: DomElement, _index: number): DomElement {
    //执行获取tbody节点
    let $dom = generateDomAction($node)
    //取出所有的行
    let domArray: HTMLElement[] = Array.prototype.slice.apply($dom.children)
    //创建td
    for (let i = 0; i < domArray.length; i++) {
        let cArray: Node[] = []
        //取出所有的列
        Array.from(domArray[i].children).forEach(item => {
            cArray.push(item)
        })
        //移除行的旧的子节点
        while (domArray[i].children.length !== 0) {
            domArray[i].removeChild(domArray[i].children[0])
        }
        cArray.splice(_index, 1)
        //插入新的子节点
        for (let j = 0; j < cArray.length; j++) {
            domArray[i].appendChild(cArray[j])
        }
    }
    //移除、新增节点事件
    removeAndInsertAction($dom, domArray)
    return $($dom.parentNode)
}

/**
 * 处理设置/取消表头
 * @param $node
 * @param _index
 * @type 替换的标签 th还是td
 */
function setTheHeader($node: DomElement, _index: number, type: string): DomElement {
    // 执行获取tbody节点
    let $dom = generateDomAction($node)
    // 取出所有的行
    let domArray: HTMLElement[] = Array.prototype.slice.apply($dom.children)
    // 列的数量
    const cols = domArray[_index].children
    // 创建新tr
    let tr = document.createElement('tr')
    for (let i = 0; i < cols.length; i++) {
        // 根据type(td 或者 th)生成对应的el
        const el = document.createElement(type)
        const col = cols[i]
        /**
         * 没有使用children是因为谷歌纯文本内容children数组就为空，而火狐纯文本内容是“xxx<br>”使用children只能获取br
         * 当然使用childNodes也涵盖支持我们表头使用表情，代码块等，不管是设置还是取消都会保留第一行
         */
        Array.from(col.childNodes).forEach(item => {
            el.appendChild(item)
        })
        tr.appendChild(el)
    }
    //插入集合中
    domArray.splice(_index, 1, tr)
    //移除、新增节点事件
    removeAndInsertAction($dom, domArray)
    return $($dom.parentNode)
}

/**
 * 封装移除、新增节点事件
 * @param $dom tbody节点
 * @param domArray  所有的行
 */
function removeAndInsertAction($dom: Element, domArray: Node[]) {
    //移除所有的旧的子节点
    while ($dom.children.length !== 0) {
        $dom.removeChild($dom.children[0])
    }
    //插入新的子节点
    for (let i = 0; i < domArray.length; i++) {
        $dom.appendChild(domArray[i])
    }
}

/**
 * 封装判断是否tbody节点
 * 粘贴的table 第一个节点是<colgroup> 最后的节点<tbody>
 * @param dom
 */
function generateDomAction($node: DomElement) {
    let $dom = $node.elems[0].children[0]
    if ($dom.nodeName === 'COLGROUP') {
        $dom = $node.elems[0].children[$node.elems[0].children.length - 1]
    }
    return $dom
}

export default {
    ProcessingRow,
    ProcessingCol,
    DeleteRow,
    DeleteCol,
    setTheHeader,
}
