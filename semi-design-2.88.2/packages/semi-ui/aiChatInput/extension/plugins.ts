import { EditorState, Plugin, PluginKey, TextSelection, Transaction } from 'prosemirror-state';
import { strings } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { EditorView } from '@tiptap/pm/view';
/**
 * @param newState 
 * @returns 
 * handleZeroWidthCharLogic 用于插入零宽字符或者删除多余的零宽字符
 * 为什么需要插入零宽字符？
 *  1. 保证自定义节点前后的光标高度正常，光标高度和内容相关，解决自定义节点是最后一个节点，
 *     光标高度会和自定义节点占据高度一致，和文本中光标高度不一致的问题
 *  2. 保证对于可编辑的 inline 节点（比如 input-slot），为最后一个节点时候，光标可以聚焦到该节点后
 *  Why do we need to insert zero-width characters?
 *  1. Ensure that the cursor height before and after the custom node is normal.
 *  The cursor height is related to the content. Solve the problem that when the custom node is the last node，
 *  the cursor height will be consistent with the height occupied by the custom node, and inconsistent with the cursor height in the text.
 *  2. Ensure that for an editable inline node (such as input-slot), when it is the last node, the cursor can focus after the node.
 */

export function handleZeroWidthCharLogic(newState: EditorState) {
    let todoPositions = [];
    let { tr } = newState;
    newState.doc.descendants((node, pos, parent) => {
        if (node.type.name === 'paragraph' && node.childCount > 0) {
            const { lastChild, firstChild } = node;
            if (firstChild && firstChild.attrs.isCustomSlot) {
                // 如果第一个 child 是自定义节点，应该在自定义节点前添加零宽字符
                // If the first child is a custom node, a zero-width character should be added before the custom node.
                // 保证光标可以移动到第一个自定义节点前
                // Ensure that the cursor can move to the first custom node before.
                todoPositions.push(pos + 1);
            }

            if (lastChild && lastChild.attrs.isCustomSlot) {
                // 在段落末尾插入一个零宽字符, 避免当自定义节点是段落最后一个节点时候，光标无法移出
                // Insert a zero-width character at the end of the paragraph to prevent 
                // the cursor from being unable to move out when custom node is the last node of the paragraph.
                const paragraphEndPos = pos + node.nodeSize - 1;
                const prevChar = tr.doc.textBetween(paragraphEndPos - 1, paragraphEndPos, '', '');
                if (prevChar !== strings.ZERO_WIDTH_CHAR) {
                    todoPositions.push(paragraphEndPos);
                }
            }
            if (lastChild === firstChild && lastChild.isText && lastChild.text === strings.ZERO_WIDTH_CHAR) {
                todoPositions.push(['remove', pos + 1]);
            }
        }
        // 保证在 undo/通过 set 修改 content 时候，没有内容的 inputSlot 节点内部有零宽字符
        // Ensure that there are zero-width characters inside the inputSlot node without content when undoing/setting content
        // 保证 input-slot 节点可以正常显示
        // Ensure that the input-slot node can be displayed normally
        if (node.type.name === 'inputSlot' && node.content.size === 0) {
            todoPositions.push(pos + 1);
        }
        /**
        * 如果连续两个节点都是 custom slot，则需要在两个节点中间插入零宽字符，用于保证
        * - 对于 input-slot，光标可以移动到两个 input-slot 之间
        * - 对于其他的非输入类型的 custom-slot，光标高度正确
        */ 
        if (node.attrs.isCustomSlot) {
            let nodeIndex = -1;
            parent.forEach((child, offset, i) => {
                if (child === node) {
                    nodeIndex = i;
                }
            });
            if (nodeIndex > -1 && nodeIndex < parent.childCount - 1) {
                const nextSibling = parent.child(nodeIndex + 1);
                if (nextSibling.attrs.isCustomSlot) {
                    todoPositions.push(pos + node.nodeSize);
                }
            }
        }
    });
    if (todoPositions.length > 0) {
        // why sorting?
        // If you insert from the beginning, the newly inserted content will affect the position of the original record.
        todoPositions.sort((a, b) => {
            const aOrder = Array.isArray(a) ? a[1] : a;
            const bOrder = Array.isArray(b) ? b[1] : b;
            return bOrder - aOrder;
        }).forEach(insertPos => {
            if (Array.isArray(insertPos) && insertPos[0] === 'remove') {
                tr = tr.delete(insertPos[1], insertPos[1] + 1);
            } else {
                tr = tr.insertText(strings.ZERO_WIDTH_CHAR, insertPos, insertPos);
            }
        });
        return tr;
    }
    return null;
}

export function ensureTrailingText(schema: any) {
    return new Plugin({
        appendTransaction(transactions, oldState, newState) {
            // 只在内容发生变化时修正，防止选区丢失
            // Only correct when content changes to prevent loss of selections
            const docChanged = transactions.some(tr => tr.docChanged);
            if (!docChanged) return null;
            // if (transactions.some(tr => tr.getMeta(strings.DeleteAble))) {
            //     // 此次 transaction 是主动删除 inputSlot，不补零宽字符
            //     // This is an active deletion of inputSlot, do not add zero-width characters
            //     return null;
            // }
            return handleZeroWidthCharLogic(newState);
        },
    });
}

export function keyDownHandlePlugin(schema: any) {
    return new Plugin({
        key: new PluginKey('prevent-empty-inline-node'),
        props: {
            handleKeyDown(view, event) {
                // console.log('handle key down plugin');
                const { state, dispatch } = view;
                const { selection } = state;
                const { $from, $to } = selection;
                const node = $from.node();
                if (event.key === 'ArrowLeft' && node.type.name !== 'inputSlot') {
                    if ($from.nodeBefore && $from.nodeBefore.isText && $from.nodeBefore.text) {
                        if ($from.nodeBefore.text === strings.ZERO_WIDTH_CHAR) {
                            // 获取零宽字符前的节点
                            // Get the node before the zero-width character
                            const parent = $from.parent;
                            const index = $from.index();
                            if (index >= 2) {
                                /**
                                 * 判断条件: 节点顺序为[···、customSlot、零宽字符、光标、····],按下 arrowLeft
                                 * - 如果 custom slot 为 input-slot， 则光标跳到 input-slot 的最后一个可聚焦位置
                                 * - 如果 custom slot 为其他不可编辑的 slot， 则光标调整到 custom slot 之前，注：不可编辑的节点大小为 1
                                 */
                                const secondBeforeCursorNode = parent.child(index - 2);
                                if (secondBeforeCursorNode.attrs.isCustomSlot) {
                                    // The end of the content in the inputSlot node
                                    const nextCursorPos = $from.pos - 2;
                                    dispatch(state.tr.setSelection(TextSelection.create(state.doc, nextCursorPos)));
                                    event.preventDefault();
                                    return true;
                                }
                            } else if (index === 1 && $from.pos !== 0) {
                                /**
                                 * 判断条件: 节点顺序为[前一个 Paragraph、换行、零宽字符、光标、····],按下 arrowLeft
                                 * 结果: [前一个 Paragraph、光标、换行、零宽字符、 ····]
                                 */
                                const nextCursorPos = $from.before() - 1;
                                nextCursorPos > 0 && dispatch(state.tr.setSelection(TextSelection.create(state.doc, nextCursorPos)));
                                event.preventDefault();
                                return true;
                            }
                        } else if ($from.nodeBefore.text.endsWith(strings.ZERO_WIDTH_CHAR)) {
                            // Backup，当零宽字符出现在 text 节点中
                            const nextCursorPos = $from.pos - 2;
                            dispatch(state.tr.setSelection(TextSelection.create(state.doc, nextCursorPos)));
                            event.preventDefault();
                            return true;
                        }
                    }


                }
                if (event.key === 'ArrowRight' && node.type.name !== 'inputSlot') {
                    if ($from.nodeAfter && $from.nodeAfter.isText) {
                        if ($from.nodeAfter.text === strings.ZERO_WIDTH_CHAR) {
                            /**
                             * 判断条件: 节点顺序为[···、光标、零宽字符、customSlot、····],按下 arrowRight
                             * - 如果 custom slot 为 input-slot， 则光标跳到 input-slot 的第一个一个可聚焦位置
                             * - 如果 custom slot 为其他不可编辑的 slot， 则光标调整到 custom slot 之后
                             */
                            // 获取零宽字符后的节点
                            // Get the node before the zero-width character
                            const parent = $from.parent;
                            const index = $from.index();
                            if (index < parent.children.length - 1) {
                                const secondAfterCursorNode = parent.child(index + 1);
                                if (secondAfterCursorNode.attrs.isCustomSlot) {
                                    // The starting position of the input-slot node
                                    const newPos = $from.pos + 2;
                                    dispatch(state.tr.setSelection(TextSelection.create(state.doc, newPos)));
                                    event.preventDefault();
                                    return true;
                                }
                            } else if (index === parent.children.length - 1 && state.doc.lastChild !== node ) {
                                /**
                                 * 判断条件: 节点顺序为[···光标、零宽字符、换行、下一个 paragraphph···],按下 arrowLeft
                                 * 结果: [···零宽字符、换行、光标、下一个 paragraphph···]
                                 */
                                const nextCursorPos = $from.after() + 1;
                                dispatch(state.tr.setSelection(TextSelection.create(state.doc, nextCursorPos)));
                                event.preventDefault();
                                return true;
                            }
                        } else if ($from.nodeBefore && $from.nodeBefore.isText && $from.nodeBefore.text.startsWith(strings.ZERO_WIDTH_CHAR)) {
                            // Backup，当零宽字符出现在 text 节点中
                            const nextCursorPos = $from.pos + 2;
                            dispatch(state.tr.setSelection(TextSelection.create(state.doc, nextCursorPos)));
                            event.preventDefault();
                            return true;
                        }
                    }
                }

                if (event.key === 'Backspace' && selection.empty) {
                    const beforeNode = $from.nodeBefore;
                    const afterNode = $from.nodeAfter;
                    /**
                     * [长度为 1 的普通文本、光标、 customSlot] ---按下删除按键--->[光标、customSlot]
                     * 专用于处理 custom slot 前为一个文本节点，且文本节点中长度为1时候，文本删除不掉的情况
                     */
                    if (
                        $from.nodeBefore && $from.nodeBefore.isText && 
                        $from.nodeBefore.text?.length === 1 && $from.nodeBefore.text !== strings.ZERO_WIDTH_CHAR &&
                        $from.nodeAfter && $from.nodeAfter.attrs.isCustomSlot
                    ) {
                        const begin = $from.pos - $from.nodeBefore.nodeSize;
                        const end = $from.pos;
                        let tr = state.tr.delete(begin, end);
                        tr = tr.insertText(strings.ZERO_WIDTH_CHAR, begin, begin);
                        dispatch(tr);
                        event.preventDefault();
                        return true;
                    }
                    // 顺序为[···、零宽字符(可能)、customSlot、光标、零宽字符(可能)、 ····] -> [···、光标、····]
                    if (beforeNode && beforeNode.attrs.isCustomSlot) {
                        const parent = $from.parent;
                        const index = $from.index();  // 当前光标在 parent.children 中的 offset
                        const initalStart = $from.pos - beforeNode.nodeSize;
                        const intialEnd = $from.pos;
                        let deleteStart = initalStart;
                        let deleteEnd = intialEnd;
                        if (index > 1) {
                            const prevPrevNode = parent.child(index - 2);
                            if (prevPrevNode && prevPrevNode.isText && prevPrevNode.text.endsWith(strings.ZERO_WIDTH_CHAR)) {
                                deleteStart = deleteStart - 1;
                            }
                        }
                        if (afterNode.isText && afterNode.text.startsWith(strings.ZERO_WIDTH_CHAR)) {
                            deleteEnd = deleteEnd + 1;
                        }
                        if (deleteStart !== initalStart || deleteEnd !== intialEnd) {
                            const tr = state.tr.delete(deleteStart, deleteEnd);
                            dispatch(tr);
                            event.preventDefault();
                            return true;
                        }
                    }

                    if (afterNode && afterNode.isText && afterNode.text === strings.ZERO_WIDTH_CHAR) {
                        const index = $from.index();  // 当前光标在 parent.children 中的 offset
                        if (index === 0 && $from.pos !== 1) {
                            /**
                             * 判断条件: 节点顺序为[····、前一个 Paragraph、换行、光标、零宽字符、····],按下 delete
                             * 结果: [前一个 Paragraph、光标 ····]
                             */
                            const startPos = selection.from - 2;
                            const tr = state.tr.delete(startPos, selection.to + 1);
                            dispatch(tr);
                            event.preventDefault();
                            return true;
                        }
                    }
                    if (beforeNode && beforeNode.isText && beforeNode.text === strings.ZERO_WIDTH_CHAR) {
                        const parent = $from.parent;
                        const index = $from.index();  // 当前光标在 parent.children 中的 offset
                        if (index > 1) {
                            /** 判断条件: 节点顺序为[···、customSlot、零宽字符、光标、····] 按下 Backspace
                             *  结果： 节点顺序为[···、光标、····]
                             */
                            const prevPrevNode = parent.child(index - 2);
                            if (prevPrevNode.attrs.isCustomSlot) {
                                const deleteStart = $from.pos - beforeNode.nodeSize - prevPrevNode.nodeSize;
                                const tr = state.tr.delete(deleteStart, $from.pos);
                                dispatch(tr);
                                event.preventDefault();
                                return true;
                            }
                            // prevPrevNode 就是你想要的光标前一个节点的前一个节点
                        } else if (index === 1 && node.type.name !== 'inputSlot') {
                            /**
                             * 判断条件：节点顺序 [···、上一个paragraph、换行、零宽字符、光标、customSlot、····]， 按下 Backspace
                             * 结果：[···、原来的上一个paragraph、光标、customSlot、····]
                             */
                            if ($from.pos !== 1) {
                                const startPos = selection.from - 1 - 2;
                                const tr = state.tr.delete(startPos, selection.to);
                                dispatch(tr);
                                event.preventDefault();
                                return true;
                            }
                        }
                    } else {
                        /**
                         * 判断条件：节点顺序为[···、inputSlot、····], 光标在 inputSlot 的首位，按下 backSpace
                         * 结论：1. 如果 inputSlot 前面是零宽字符，则直接将光标移动到零宽字符之前
                         * 2. 如果前面不是零宽字符，则在 inputSlot 前面添加零宽字符，并将光标移动到零宽字符前
                         *    用于解决光标在 inputSlot 前，按下 backSpace，出现 inputSlot 前的内容被删除问题
                         */
                        if (node.type.name === 'inputSlot' && $from.pos === $from.start()) {
                            // 1. 如果前面是零宽字符，则直接将光标移动到零宽字符之前
                            const grandParent = $from.node($from.depth - 1);
                            let parentPrevNode = null;
                            const parentIndex = $from.index($from.depth - 1);
                            if (parentIndex > 0) {
                                parentPrevNode = grandParent.child(parentIndex - 1);
                                if (parentPrevNode && parentPrevNode.isText && parentPrevNode.text.endsWith(strings.ZERO_WIDTH_CHAR)) {
                                    const pos = $from.pos - 2;
                                    dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
                                    event.preventDefault();
                                    return true;
                                }
                            }
                            // 2. 如果前面不是零宽字符，则插入一个零宽字符，并将光标移动到零宽字符之前
                            const pos = $from.pos - 1;
                            let tr = state.tr.insertText(strings.ZERO_WIDTH_CHAR, pos, pos + 1);
                            tr = tr.setSelection(TextSelection.create(tr.doc, pos));
                            dispatch(tr);
                            event.preventDefault();
                            return true;
                        }
                    }
                }

                if (event.key === 'Backspace' && !selection.empty) {
                    let startPos = selection.from;
                    let endPos = selection.to;
                    const nodeBefore = $from.nodeBefore;
                    const nodeAfter = $from.nodeAfter;
                    if (nodeBefore && nodeBefore.isText && nodeBefore.text.endsWith(strings.ZERO_WIDTH_CHAR)) {
                        startPos -= 1;
                    }
                    if (nodeAfter && nodeAfter.isText && nodeAfter.text.startsWith(strings.ZERO_WIDTH_CHAR)) {
                        endPos += 1;
                    }
                    if (startPos !== selection.from || endPos !== selection.to) {
                        let tr = state.tr.delete(startPos, endPos);
                        dispatch(tr);
                        event.preventDefault();
                        return true;
                    }
                }

                // 光标在 inputSlot 的内部
                if (node.type.name === 'inputSlot') {
                    // 处理当显示 placeholder 时候，按键的光标移动，保证通过一次按键，光标就跳出节点
                    // When the placeholder is displayed, the cursor of the button moves to ensure that the cursor 
                    // jumps out of the node after pressing the button once.
                    if (node.textContent === strings.ZERO_WIDTH_CHAR &&
                        (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                    ) {
                        // 如果光标在节点内，按左右键时直接跳出节点
                        // If the cursor is within a node, press the left and right keys to jump out of the node directly.
                        const pos = event.key === 'ArrowLeft' ? $from.before() : $from.after();
                        // 拿到光标的选区位置
                        if (selection.from - pos !== 1 && selection.from - pos !== -1) {
                            dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
                            event.preventDefault();
                            return true;
                        }
                    }
                    // 删除 input-slot 的最后一个字符时，插入零宽字符
                    // When removing the last character of input-slot, insert a zero-width character
                    if ($from.pos === $from.end() && node.textContent.length === 1 && node.textContent !== strings.ZERO_WIDTH_CHAR &&
                        event.key === 'Backspace'
                    ) {
                        const pos = $from.pos - 1;
                        dispatch(state.tr.insertText(strings.ZERO_WIDTH_CHAR, pos, pos + 1));
                        event.preventDefault();
                        return true;
                    }

                    // 全选 input-slot 节点内容时，点击删除，插入零宽字符
                    // When selecting all input-slot node content, insert zero-width characters
                    if (!selection.empty && $from.parent === node &&
                        selection.from === $from.start() && selection.to >= $from.end() &&
                        (event.key === 'Backspace')
                    ) {
                        const tr = state.tr;
                        // 删除 inputSlot 之后被选中的内容
                        // Delete the selected content after inputSlot
                        if (selection.to > $from.end()) {
                            tr.delete($from.end(), selection.to);
                        }
                        // 替换 inputSlot 内部内容为 ZERO_WIDTH_CHAR
                        // Replace the internal content of inputSlot with ZERO_WIDTH_CHAR
                        tr.insertText(strings.ZERO_WIDTH_CHAR, $from.start(), $from.end());
                        const pos = $from.start() + 1; // 1 是零宽字符的长度
                        tr.setSelection(TextSelection.create(tr.doc, pos));
                        dispatch(tr);
                        event.preventDefault();
                        return true;
                    }
                    // 如果内容只剩零宽字符，再次删除时允许节点被删
                    // If only zero-width characters remain in the content, allow the node to be deleted when deleting again.
                    if (node.textContent === strings.ZERO_WIDTH_CHAR &&
                    (event.key === 'Backspace')
                    ) {
                        // 计算当前节点在文档中的位置
                        // Calculate the position of the current node in the document
                        const pos = $from.before();
                        dispatch(state.tr.delete(pos, pos + node.nodeSize));
                        event.preventDefault();
                        return true;
                    }
                }
                return false;
            },
        },
    });
}

export function handlePasteLogic(view: EditorView, event: ClipboardEvent) {
    // If there is rich text content, let tiptap handle it by default
    const types = event.clipboardData?.types || [];
    const html = event.clipboardData?.getData('text/html');
    // 如果包含 html 内容，并且 html 内容中包含 input-slot, select-slot, skill-slot 节点，则不阻断
    // todo：增加用户扩展 slot 的判断
    if ((types.includes('text/html') && (['<input-slot', '<select-slot', '<skill-slot'].some(slot => html?.includes(slot))))
        || types.includes('application/x-prosemirror-slice')) {
        return false;
    }
    const text = event.clipboardData?.getData('text/plain');
    if (text) {
        const { state, dispatch } = view;
        const $from = state.selection.$from;
        let tr = state.tr;
        removeZeroWidthChar($from, tr);
        /* Use tr to continue the subsequent pasting logic and solve the problem of unsuccessful line wrapping of content 
            pasted from certain web pages, such as the code of Feishu Documents */
        const lines = text.split('\n');
        let finalCursorPos = null;
        if (lines.length === 1) {
            // Insert the first line directly
            tr = tr.insertText(lines[0], tr.selection.from, tr.selection.to);
            finalCursorPos = tr.selection.$to.pos;
        } else {
            // other lines, insert one by one
            tr = tr.insertText(lines[0], tr.selection.from, tr.selection.to);
            let pos = tr.selection.$to.pos;
            for (let i = 1; i < lines.length; i++) {
                const paragraph = state.schema.nodes.paragraph.create(
                    {},
                    lines[i] ? state.schema.text(lines[i]) : null
                );
                tr = tr.insert(pos, paragraph);
                pos += paragraph.nodeSize;
            }
            finalCursorPos = pos; // 粘贴多行时，光标应在最后插入内容末尾
        }
        // 设置 selection 到粘贴内容末尾
        tr = tr.setSelection(TextSelection.create(tr.doc, finalCursorPos));
        // scroll to the pasted position
        tr = tr.scrollIntoView();
        dispatch(tr);
        event.preventDefault();
        return true;
    }
    return false;
}

export function removeZeroWidthChar($from: any, tr: Transaction) {
    // Handling zero-width characters before and after pasting
    // Check the previous node of the cursor
    if ($from.nodeBefore && $from.nodeBefore.isText && $from.nodeBefore.text === strings.ZERO_WIDTH_CHAR) {
        tr = tr.delete($from.pos - $from.nodeBefore.nodeSize, $from.pos);
        return true;
    }
    // Check the node after the cursor
    if ($from.nodeAfter && $from.nodeAfter.isText && $from.nodeAfter.text === strings.ZERO_WIDTH_CHAR) {
        tr = tr.delete($from.pos, $from.pos + $from.nodeAfter.nodeSize);
        return true;
    }
    return false;
}

export function removeZeroWidthCharForComposition($from: any, tr: Transaction) {
    // 检查光标左侧的 text node 是否以零宽字符开头
    if ($from.nodeBefore && $from.nodeBefore.isText) {
        const text = $from.nodeBefore.text;
        if (text?.startsWith(strings.ZERO_WIDTH_CHAR)) {
            // 删除第一个字符
            const removeStart = $from.pos - $from.nodeBefore.nodeSize;
            const removeEnd = removeStart + 1; // 只删开头零宽字符
            tr = tr.delete(removeStart, removeEnd);
            return tr;
        }
    }
    // 或者再补 $from.nodeAfter 的情况（一般只需要 nodeBefore）
    return null;
}

export function handleCompositionEndLogic(view: EditorView) {    // composition 结束时再移除零宽字符
    const { state, dispatch } = view;
    const $from = state.selection.$from;
    let tr = state.tr;
    let modified = removeZeroWidthCharForComposition($from, tr);
    if (modified) {
        dispatch(tr);
    }
}

export function handleTextInputLogic(view: EditorView, from: number, to: number, text: string) {
    const { state, dispatch } = view;
    const $from = state.selection.$from;
    let tr = state.tr;
    let modified = removeZeroWidthChar($from, tr);

    // Remove zero-width characters before inserting text
    if (modified) {
        tr = tr.insertText(text, tr.selection.from, tr.selection.to);
        dispatch(tr);
        return true; // prevent default
    }
    return false; // continue default behavior
}