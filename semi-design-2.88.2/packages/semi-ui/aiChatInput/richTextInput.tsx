import { Editor, EditorContent, Extension, useEditor } from '@tiptap/react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import { UndoRedo } from '@tiptap/extensions';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import { Placeholder } from '@tiptap/extensions';
import InputSlot from './extension/inputSlot';
import SelectSlot from './extension/selectSlot';
import SkillSlot from './extension/skillSlot';
import { strings } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { Content as TiptapContent } from "@tiptap/core";
import { cssClasses } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { EditorView } from '@tiptap/pm/view';
import { handleCompositionEndLogic, handlePasteLogic, handleTextInputLogic, handleZeroWidthCharLogic } from './extension/plugins';
import SemiStatusExtension from './extension/statusExtension';

const PREFIX = cssClasses.PREFIX;

export default (props: {
    innerRef?: React.Ref<HTMLDivElement>;
    defaultContent?: TiptapContent;
    placeholder?: string;
    setEditor?: (editor: Editor) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
    onChange?: (content: string) => void;
    extensions?: Extension[];
    handleKeyDown?: (view: any, event: KeyboardEvent) => boolean;
    onPaste?: (files: File[]) => void;
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    handleCreate?: () => void
}) => {
    const { setEditor, onKeyDown, onChange, placeholder, extensions = [], 
        defaultContent, onPaste, innerRef, handleKeyDown, onFocus, onBlur, handleCreate } = props;
    const isComposing = useRef(false);
    
    const handleCompositionStart = useCallback((view: EditorView) => {
        isComposing.current = true;
    }, []);

    const handleCompositionEnd = useCallback((view: EditorView) => {
        isComposing.current = false;
        handleCompositionEndLogic(view);
    }, []);

    const handleTextInput = useCallback((view: EditorView, from: number, to: number, text: string) => {
        if (isComposing.current) {
            return false;
        }
        return handleTextInputLogic(view, from, to, text);
    }, []);

    const allExtensions = useMemo(() => {
        return [
            Document, Paragraph, Text, UndoRedo, HardBreak, 
            InputSlot, SelectSlot, SkillSlot,
            Placeholder.configure({
                placeholder: placeholder,
            }),
            SemiStatusExtension,
            ...extensions,
        ];
    }, [extensions, placeholder]);

    const editorProps = useMemo(() => {
        return {
            handleKeyDown: handleKeyDown,
            handlePaste: handlePasteLogic,
            handleTextInput,
            handleDOMEvents: {
                compositionstart: handleCompositionStart,
                compositionend: handleCompositionEnd,
            }
        };
    }, [handleKeyDown, handleTextInput, handleCompositionStart, handleCompositionEnd]);

    // const onSelectionUpdate = useCallback(({ editor }) => {
    //     // For debug
    //     const fromPos = editor.state.selection.from;
    //     const { $from } = editor.state.selection;
    //     console.log('光标/选区位置', fromPos, editor.state.selection, editor.state.doc);
    //     // console.log('before', $from.nodeBefore, $from.nodeAfter);
    // }, []);

    const onCreate = useCallback(({ editor }) => {
        const { state, view } = editor;
        const tr = handleZeroWidthCharLogic(state);
        if (tr) {
            // 一次性触发，避免多次触发导致 appendTransaction 被多次调用
            view.dispatch(tr);
        }
        handleCreate();
    }, [handleCreate]);

    const onUpdate = useCallback(({ editor }) => {
        // The content has changed.
        const content = editor.getText();
        onChange(content);
    }, [onChange]);

    const handlePaste = useCallback((e) => {
        // To support file paste
        const items = e.clipboardData?.items as any;
        let files = [];
        if (items) {
            for (const it of items) {
                const file = it.getAsFile();
                file && files.push(it.getAsFile());
            }
        }
        if (files.length) {
            onPaste?.(files);
        }
    }, [onPaste]);

    const editor = useEditor({
        extensions: allExtensions as Extension[],
        content: defaultContent ?? ``,
        editorProps: editorProps,
        // onSelectionUpdate,
        onCreate,
        onUpdate,
        onPaste: handlePaste,
    });

    useEffect(() => {
        setEditor(editor);
    }, [editor, setEditor]);

    return (<>
        <EditorContent 
            editor={editor} 
            onKeyDown={onKeyDown as any}
            onFocus={onFocus as any}
            onBlur={onBlur as any}
            ref={innerRef}
            className={`${PREFIX}-editor-content`}
        />
    </>);
};
