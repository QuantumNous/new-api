import { computePosition, flip, shift } from '@floating-ui/dom';
import { posToDOMRect, ReactRenderer } from '@tiptap/react';
import MentionList, { FirstLevel } from './mentionList';
import './index.scss';

const updatePosition = (editor: any, element: any) => {
    const virtualElement = {
        getBoundingClientRect: () => posToDOMRect(
            editor.view,
            editor.state.selection.from,
            editor.state.selection.to,
        ),
    };

    computePosition(virtualElement, element, {
        placement: 'bottom-start',
        strategy: 'absolute',
        middleware: [shift(), flip()],
    }).then(({ x, y, strategy }) => {
        element.style.width = 'max-content';
        element.style.position = strategy;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    });
};

const suggestion = {
    // items: ({ query }: any) => FirstLevel,
    items: () => FirstLevel,

    command: (obj: any) => {
        const { editor, range, props } = obj;
        const { item, allowHotKeySend } = props;
        if (typeof allowHotKeySend === 'boolean') {
            editor.storage.SemiAIChatInput.allowHotKeySend = allowHotKeySend;
        }
        item && editor.chain().focus().insertContentAt(range, {
            type: 'referSlot',
            attrs: {
                type: item.type,
                value: item.name || '',
                info: JSON.stringify({ path: item.path }),
                uniqueKey: item.key,
            },
        }).run();
    },

    render: () => {
        let component: any;

        return {
            onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                });

                if (!props.clientRect) return;

                component.element.style.position = 'absolute';

                document.body.appendChild(component.element);

                updatePosition(props.editor, component.element);
            },

            onUpdate(props: any) {
                component.updateProps(props);

                if (!props.clientRect) return;

                updatePosition(props.editor, component.element);
            },

            onKeyDown(props: any) {
                function onExit() {
                    component.destroy();
                }

                return component.ref?.onKeyDown({ ...props, exitCb: onExit });
            },

            onExit() {
                component.element.remove();
                component.destroy();
            },

            focusEditor(props: any) {
                props.editor.commands.focus();
            },
        };
    },
};

export default suggestion;
