import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { getCustomSlotAttribute } from '@douyinfe/semi-foundation/aiChatInput/utils';

function ReferSlotComponent(props) {
    const { node } = props;
    const value = node.attrs.value ?? '';

    return (
        <NodeViewWrapper className="refer-slot-wrapper">
            <span className='refer-slot'>
                {value}
            </span>
        </NodeViewWrapper>
    );
}

const ReferSlot = Node.create({
    name: 'referSlot',
    inline: true,
    group: 'inline',
    atom: true,
    selectable: false,

    addAttributes() {
        return {
            value: {
                default: '输入内容',
                parseHTML: (element) =>
                    element.getAttribute('data-value'),
                renderHTML: (attributes) => ({
                    'data-value': attributes.value,
                }),
            },
            info: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-info'),
                renderHTML: (attributes) => ({
                    'data-info': attributes.info,
                }),
            },
            type: {
                default: 'text',
                parseHTML: (element) =>
                    element.getAttribute('data-type'),
                renderHTML: (attributes) => ({
                    'data-type': attributes.type,
                }),
            },
            uniqueKey: {
                default: '',
                parseHTML: (element) =>
                    element.getAttribute('data-unique-key'),
                renderHTML: (attributes) => ({
                    'data-unique-key': attributes.uniqueKey,
                }),
            },
            isCustomSlot: getCustomSlotAttribute(),
        };
    },

    parseHTML() {
        return [{
            tag: 'refer-slot',
        }];
    },

    renderHTML({ HTMLAttributes }) {
        // 序列化时输出自定义标签，保留值到 data-value
        return ['refer-slot', mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ReferSlotComponent);
    },
});

export default ReferSlot;
