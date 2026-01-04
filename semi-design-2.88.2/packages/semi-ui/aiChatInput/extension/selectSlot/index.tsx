import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useCallback } from 'react';
import { Select } from '../../../index';
import { getCustomSlotAttribute } from '@douyinfe/semi-foundation/aiChatInput/utils';
import { strings } from '@douyinfe/semi-foundation/aiChatInput/constants';

function SelectSlotComponent(props: NodeViewProps) {
    const { node, updateAttributes } = props;
    const value: string = node.attrs.value ?? '';
    const options: Array<{ value: string; label: string }> = JSON.parse(node.attrs.options || '[]').
        map((option: string) => ({ value: option, label: option }));

    const handleChange = useCallback(
        (val: string | number | any[] | Record<string, any> | undefined) => {
            if (typeof val === 'string') {
                updateAttributes({ value: val });
            }
        },
        [updateAttributes],
    );

    return (
        <NodeViewWrapper className="select-slot-wrapper">
            <Select
                className="select-slot"
                optionList={options}
                value={value}
                onChange={handleChange}
            />
        </NodeViewWrapper>
    );
}

const SelectSlot = Node.create({
    name: 'selectSlot',
    inline: true,
    group: 'inline',
    atom: true,
    selectable: false,

    addAttributes() {
        return {
            value: {
                default: strings.ZERO_WIDTH_CHAR,
                parseHTML: (element: HTMLElement) =>
                    element.getAttribute('value'),
                renderHTML: (attrs: Record<string, any>) => ({ value: attrs.value }),
            },
            options: {
                default: '',
                parseHTML: (element: HTMLElement) =>
                    element.getAttribute('options') || '',
                renderHTML: (attrs: Record<string, any>) => attrs.options ? { options: attrs.options } : {},
            },
            isCustomSlot: getCustomSlotAttribute(),
        };
    },

    parseHTML() {
        return [ {
            tag: 'select-slot',
        }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['select-slot', mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(SelectSlotComponent);
    },
});

export default SelectSlot;
