import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Component from './component';
import { getCustomSlotAttribute } from '@douyinfe/semi-foundation/aiChatInput/utils';
import { ensureTrailingText, keyDownHandlePlugin } from '../plugins';

export const REACT_COMPONENT_NODE_NAME = 'inputSlot';

export default Node.create({
    name: 'inputSlot',
    group: 'inline',
    inline: true,
    // Allow text and other inline nodes inside
    content: 'inline*',
    // Allow editing
    atom: false,
    selectable: true,
    draggable: false,

    parseHTML() {
        return [
            {
                tag: 'input-slot',
                getAttrs: element => ({
                    placeholder: element.getAttribute('placeholder'),
                }),
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['input-slot', mergeAttributes(HTMLAttributes), 0];
    },

    addAttributes() {
        return {
            placeholder: {
                default: '',
                parseHTML: element => element.getAttribute('placeholder') || '',
                renderHTML: attributes => ({
                    'placeholder': attributes.placeholder,
                }),
            },
            isCustomSlot: getCustomSlotAttribute(),
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(Component);
    },

    addProseMirrorPlugins() {
        return [
            ensureTrailingText(this.editor.schema),
            keyDownHandlePlugin(this.editor.schema),
        ];
    },
});
