import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { IconClose } from '@douyinfe/semi-icons';
import React from 'react';
import { getCustomSlotAttribute } from '@douyinfe/semi-foundation/aiChatInput/utils';

function SkillSlotComponent(props: NodeViewProps) {
    const { node, editor } = props;
    
    const value: string = node.attrs.label ?? node.attrs.value ?? '';

    const onRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        editor?.commands.clearContent();
    };

    if (value === '') {
        return null;
    }

    return (
        <NodeViewWrapper className="skill-slot-wrapper">
            <span className='skill-slot'>
                {value}
                <IconClose
                    onClick={onRemove}
                    className='skill-slot-delete'
                />
            </span>
        </NodeViewWrapper>
    );
}

const SkillSlot = Node.create({
    name: 'skillSlot',
    inline: true,
    group: 'inline',
    atom: true,

    selectable: false,

    addAttributes() {
        return {
            value: {
                default: '',
                parseHTML: (element: HTMLElement) => (element as HTMLElement).getAttribute('data-value'),
                renderHTML: (attributes: Record<string, any>) => ({ 'data-value': attributes.value }),
            },
            label: {
                parseHTML: (element: HTMLElement) => (element as HTMLElement).getAttribute('data-label'),
                renderHTML: (attributes: Record<string, any>) => ({ 'data-label': attributes.label }),
            },
            hasTemplate: {
                parseHTML: (element: HTMLElement) => (element as HTMLElement).getAttribute('data-template'),
                renderHTML: (attributes: Record<string, any>) => ({ 'data-template': attributes.hasTemplate }),
            },
            isCustomSlot: getCustomSlotAttribute(),
        };
    },

    parseHTML() {
        return [{
            tag: 'skill-slot',
        }];
    },

    renderHTML({ HTMLAttributes: htmlAttributes }) {
        return ['skill-slot', mergeAttributes(htmlAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(SkillSlotComponent);
    },
});

export default SkillSlot;
