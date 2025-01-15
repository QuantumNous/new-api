/**
 * @description 撤销 - 逆向操作，删除节点
 * @author fangzhicong
 */
import { Compile } from '../type'

/**
 * 将节点添加到 DOM 树中
 * @param data 数据项
 * @param list 节点集合（addedNodes 或 removedNodes）
 */
function insertNode(data: Compile, list: Node[]) {
    let reference = data.position.target
    switch (data.position.type) {
        // reference 在这些节点的前面
        case 'before':
            if (reference.nextSibling) {
                reference = reference.nextSibling
                list.forEach((item: Node) => {
                    data.target.insertBefore(item, reference)
                })
            } else {
                list.forEach((item: Node) => {
                    data.target.appendChild(item)
                })
            }
            break
        // reference 在这些节点的后面
        case 'after':
            list.forEach((item: Node) => {
                data.target.insertBefore(item, reference)
            })
            break
        // parent
        // reference 是这些节点的父节点
        default:
            list.forEach((item: Node) => {
                reference.appendChild(item)
            })
            break
    }
}

/* ------------------------------------------------------------------ 撤销逻辑 ------------------------------------------------------------------ */

function revokeNode(data: Compile) {
    for (let [relative, list] of Object.entries(data.nodes)) {
        switch (relative) {
            // 反向操作，将这些节点从 DOM 中移除
            case 'add':
                list.forEach((item: Node) => {
                    data.target.removeChild(item)
                })
                break
            // remove（反向操作，将这些节点添加到 DOM 中）
            default: {
                insertNode(data, list)
                break
            }
        }
    }
}

/**
 * 撤销 attribute
 */
function revokeAttr(data: Compile) {
    let target = data.target as HTMLElement
    if (data.oldValue == null) {
        target.removeAttribute(data.attr)
    } else {
        target.setAttribute(data.attr, data.oldValue)
    }
}

/**
 * 撤销文本内容
 */
function revokeText(data: Compile) {
    data.target.textContent = data.oldValue
}

const revokeFns = {
    node: revokeNode,
    text: revokeText,
    attr: revokeAttr,
}

// 撤销 - 对外暴露的接口
export function revoke(data: Compile[]) {
    for (let i = data.length - 1; i > -1; i--) {
        let item = data[i]
        revokeFns[item.type](item)
    }
}

/* ------------------------------------------------------------------ 恢复逻辑 ------------------------------------------------------------------ */

function restoreNode(data: Compile) {
    for (let [relative, list] of Object.entries(data.nodes)) {
        switch (relative) {
            case 'add': {
                insertNode(data, list)
                break
            }
            // remove
            default: {
                list.forEach((item: Node) => {
                    ;(item.parentNode as Node).removeChild(item)
                })
                break
            }
        }
    }
}

function restoreText(data: Compile) {
    data.target.textContent = data.value
}

function restoreAttr(data: Compile) {
    ;(data.target as HTMLElement).setAttribute(data.attr, data.value)
}

const restoreFns = {
    node: restoreNode,
    text: restoreText,
    attr: restoreAttr,
}

// 恢复 - 对外暴露的接口
export function restore(data: Compile[]) {
    for (let item of data) {
        restoreFns[item.type](item)
    }
}
