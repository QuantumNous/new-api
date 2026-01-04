import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { Attachment, BaseSkill, Suggestion, Reference, Content, LeftMenuChangeProps, MessageContent } from './interface';
import { get, isNumber, isString } from 'lodash';
import { cssClasses } from './constants';
import { findSkillSlotInString, getSkillSlotString, transformJSONResult } from './utils';

export interface AIChatInputAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    reposPopover: () => void;
    setContent: (content: any) => void;
    focusEditor: (pos?: any) => void;
    getTriggerWidth: () => number;
    getEditor: () => any;
    getPopupID: () => string;
    notifyContentChange: (result: Content[]) => void;
    notifyConfigureChange: (value: LeftMenuChangeProps, changedValue: LeftMenuChangeProps) => void;
    manualUpload: (files: File[]) => void;
    notifyMessageSend: (props: MessageContent) => void;
    notifyStopGenerate: () => void;
    notifySkillChange: (skill: BaseSkill) => void;
    clearContent: () => void;
    clearAttachments: () => void;
    getRichTextDiv: () => HTMLDivElement | null;
    registerClickOutsideHandler: (cb: (e: any) => void) => void;
    unregisterClickOutsideHandler: () => void;
    handleReferenceDelete: (reference: Reference) => void;
    handleReferenceClick: (reference: Reference) => void;
    isSelectionText: (selection: any) => boolean;
    createSelection: (node: any, pos: number) => any;
    notifyFocus: (event: any) => void;
    notifyBlur: (event: any) => void;
    getConfigureValue: () => any
}

const prefixCls = cssClasses.PREFIX;

export default class AIChatInputFoundation extends BaseFoundation<AIChatInputAdapter> {

    constructor(adapter: AIChatInputAdapter) {
        super({ ...AIChatInputFoundation.defaultAdapter, ...adapter });
    }

    init = () => {};

    mouseDownTarget: HTMLElement | null = null;

    destroy = () => {
        this._adapter.unregisterClickOutsideHandler();
    }

    handleSkillSelect = (skill: BaseSkill) => {
        this.setState({
            skill: skill,
            skillVisible: false
        });
        this._adapter.notifySkillChange(skill);
        this._adapter.setContent(getSkillSlotString(skill));
        this._adapter.focusEditor();
    }

    setDropdownWidth() {
        const { style, dropdownMatchTriggerWidth } = this.getProps();
        let width: number;
        if (dropdownMatchTriggerWidth) {
            if (style && isNumber(style.width)) {
                width = style.width;
            } else if (style && isString(style.width) && !style.width.includes('%')) {
                width = style.width;
            } else {
                width = this._adapter.getTriggerWidth();
            }  
        }
        if (width) {
            this.setState({
                popupWidth: width
            });
        }
    }

    changeTemplateVisible = (value: boolean) => {
        value && this.setDropdownWidth();
        this.setState({ templateVisible: value });
    }

    handlePaste = (files: File[]) => {
        this._adapter.manualUpload(files);
    }
    
    handleSuggestionSelect = (suggestion: Suggestion) => {
        this._adapter.setContent(suggestion as unknown as string);
        this._adapter.focusEditor();
    }

    handleUploadFileDelete = (attachment: Attachment) => {
        const { attachments } = this.getStates();
        const newAttachments = attachments.filter(item => item.uid !== attachment.uid);
        this.setState({
            attachments: newAttachments
        });
    }

    handleReferenceDelete = (reference: Reference) => {
        this._adapter.handleReferenceDelete(reference);
    }

    handleReferenceClick = (reference: Reference) => {
        this._adapter.handleReferenceClick(reference);
    }

    setActiveSuggestionIndex = (index: number) => {
        this.setState({ activeSuggestionIndex: index });
    }

    setActiveSkillIndex = (index: number) => {
        this.setState({ activeSkillIndex: index });
    }

    handleKeyDown = (e: KeyboardEvent) => {
        const { skills, suggestions, skillHotKey } = this.getProps();
        const { skillVisible, suggestionVisible } = this.getStates();
        const editor = this._adapter.getEditor();
        const oldValue = editor?.getText();
        const { activeSkillIndex, activeSuggestionIndex } = this.getStates();
        const popUpOptionListID = this._adapter.getPopupID();
        // 输入框为空，且按下 skillHotKey 键, 触发 skill 面板打开
        // The input box is empty and the skill hot key is pressed to trigger the skill panel to open.
        if (oldValue === '' && e.key === skillHotKey && skills && skills.length) {
            // Open skill panel
            this.setState({ skillVisible: true });
            this.setDropdownWidth();
        } else if ((oldValue === skillHotKey || oldValue?.length === 0) && e.key === 'Backspace') {
            // Close function panel
            this.setState({ skillVisible: false });
        } else if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
            // If the input box is a skill's hotkey/when suggestion visible, pressing the up and down keys can switch panel options.
            if (oldValue === skillHotKey && skills && skills.length) {
                const newIndex = (activeSkillIndex + (e.key === 'ArrowUp' ? -1 : 1) + skills.length) % skills.length;
                this.setActiveSkillIndex(newIndex);
                this.updateScrollTop(newIndex, `#${prefixCls}-skill-${popUpOptionListID} .${prefixCls}-skill-item:nth-child(${newIndex + 1})`);
            } else if (suggestionVisible && suggestions?.length) {
                const newIndex = (activeSuggestionIndex + (e.key === 'ArrowUp' ? -1 : 1) + suggestions.length) % suggestions.length;
                this.setActiveSuggestionIndex(newIndex);
                this.updateScrollTop(newIndex, `#${prefixCls}-suggestion-${popUpOptionListID} .${prefixCls}-suggestion-item:nth-child(${newIndex + 1})`);
            }
        } else if (e.key === 'Enter') {
            if (skillVisible) {
                this.setState({ skillVisible: false });
                const newSkill = skills[activeSkillIndex];
                newSkill && this.handleSkillSelect(newSkill);
            } else if (suggestionVisible) {
                const newSuggestion = suggestions[activeSuggestionIndex];
                this.handleSuggestionSelect(newSuggestion);
                this.hideSuggestionPanel();
            }
        } else if (e.key === 'Escape') {
            // 如果按下 Escape，检查各个层级的可见性
            // If Escape is pressed, check the visibility of each level
            skillVisible && this.setState({ skillVisible: false });
            suggestionVisible && this.hideSuggestionPanel();
        }
    }

    onConfigureChange = (value: LeftMenuChangeProps, changedValue: LeftMenuChangeProps) => {
        this._adapter.notifyConfigureChange(value, changedValue);
    }


    updateScrollTop = (index?: number, selector?: string) => {
        if (index === undefined) {
            return;
        }
        let destNode = document.querySelector(selector) as HTMLDivElement;
        if (destNode) {
            /**
             * Scroll the first selected item into view.
             * The reason why ScrollIntoView is not used here is that it may cause page to move.
             */
            const destParent = destNode.parentNode as HTMLDivElement;
            destParent.scrollTop = destNode.offsetTop -
                destParent.offsetTop -
                (destParent.clientHeight / 2) +
                (destNode.clientHeight / 2);
        }
    }

    showSuggestionPanel = () => {
        this.setState({ suggestionVisible: true });
        this.setDropdownWidth();
        this._adapter.registerClickOutsideHandler(this.hideSuggestionPanel);
    }

    hideSuggestionPanel = () => {
        this.setState({ suggestionVisible: false });
        this._adapter.unregisterClickOutsideHandler();
    }

    handleCreate = () => {
        this.setState({ richTextInit: true });
    }

    handleContentChange = (content: string) => {
        const { transformer } = this.getProps();
        const { skill } = this.getStates();
        const editor = this._adapter.getEditor();
        const html = editor.getHTML();
        if (skill && !html.includes('</skill-slot>')) {
            this.setState({ 
                skill: undefined,
                templateVisible: false
            });
            this._adapter.notifySkillChange(undefined);
            this._adapter.notifyContentChange([]);
            return;
        } else if (html.includes('</skill-slot>')) {
            const newSkill = findSkillSlotInString(html);
            if (newSkill?.value !== skill?.value) {
                this.setState({ skill: newSkill });
                this._adapter.notifySkillChange(newSkill);
            }
        }
        const jsonResult = editor.getJSON();
        const finalResult = transformJSONResult(jsonResult, transformer);
        this._adapter.notifyContentChange(finalResult);
        this.setState({
            content: jsonResult,
        });
        this._adapter.reposPopover();
    }

    onUploadChange = (props: any) => {
        const { fileList } = props;
        const { onUploadChange } = this.getProps();
        onUploadChange?.(props);
        const { uploadProps } = this.getProps();
        const { onChange } = uploadProps;
        onChange?.(props);
        this.setState({
            attachments: fileList,
        });
    }

    _isRichTextEmpty = () => {
        /*
        空内容时候的 json 结构:
        Json structure when empty content:
        {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": --
                }
            ]
        }
        */
        const editor = this._adapter.getEditor();
        if (!editor) {
            return true;
        }
        const json = editor.getJSON?.();
        const level2Content = json.content[0].content;
        if (level2Content === undefined) {
            return true;
        }
        return false;
    }

    canSend = () => {
        const canSend = this.getProp('canSend');
        if (canSend !== undefined) {
            return canSend;
        }
        const { attachments } = this.getStates();
        const validRichText = !this._isRichTextEmpty();
        const validAttachment = Array.isArray(attachments) && (attachments.length > 0);
        return validRichText || validAttachment;
    }

    handleSend = () => {
        const { generating, transformer } = this.getProps();
        if (generating) {
            this._adapter.notifyStopGenerate();
            return;
        } else {
            if (!this.canSend()) {
                return;
            }
            const references = this.getProp('references');
            const { attachments } = this.getStates();
            const editor = this._adapter.getEditor();
            let richTextResult = [];
            if (editor) {
                const json = editor.getJSON?.();
                richTextResult = transformJSONResult(json, transformer);
            }
            // close popup layer for template/skill/suggestion
            this.setState({
                templateVisible: false,
                skillVisible: false,
                suggestionVisible: false,
            });
            this._adapter.notifyMessageSend({
                references,
                attachments,
                inputContents: richTextResult,
                setup: this._adapter.getConfigureValue() ?? {}
            });
        }
    }

    handleContainerMouseDown = (e: React.MouseEvent) => {
        this.mouseDownTarget = e.target as HTMLElement;
    }

    handleContainerClick = (e: React.MouseEvent) => {
        const target = e.target;
        if (this.mouseDownTarget && this.mouseDownTarget !== e.target) {
            // 注意：这个判断是为了防止在富文本区域按下鼠标/键盘触控板，选择选区，然后拖动鼠标/键盘触控板，
            // 释放鼠标/触控板的位置在富文本区域之外，导致选区丢失的问题。
            // Note: This judgment is to prevent pressing the mouse/keyboard trackpad in the rich text area, 
            // selecting the selection, and then dragging the mouse/keyboard trackpad.
            // The issue where the mouse/trackpad is released outside the rich text area causes the selection to be lost.
            return;
        }
        const richTextDiv = this._adapter.getRichTextDiv();
        if (richTextDiv && (richTextDiv === target || richTextDiv.contains(target as Node))) {
            const { suggestions } = this.getProps();
            if (suggestions && suggestions.length > 0) {
                this.showSuggestionPanel();
            }
            return;
        }
        this._adapter.focusEditor();
    }

    handRichTextArealKeyDown = (view: any, event: KeyboardEvent) => {
        // console.log('outer key down handle');
        const { suggestionVisible, skillVisible } = this.getStates();
        /**
         * 当建议/技能面板可见时候，上下按键，enter 按键被用于操作面板选项的 active 项，或做选中操作的，
         * 因此需要 return true 阻止富文本输入区域默认的按键操作
         * When the suggestion/skill panel is visible, the up and down keys and the enter key are 
         * used to activate or select the active item in the panel.
         * Therefore, we need to return true to prevent the default key operation of the rich text input area
         */
        if ((suggestionVisible || skillVisible) && ['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) {
            return true;
        }
        const editor = this._adapter.getEditor() ?? {};
        const allowHotKeySend = get(editor, 'storage.SemiAIChatInput.allowHotKeySend');
        if (event.key === 'Enter' && !event.shiftKey && allowHotKeySend) {
            this.handleSend();
            return true;
        }
        if (event.key === 'Enter' && event.shiftKey) {
            /**
             * Tiptap 默认情况下 Enter + Shift 时候是使用 <br /> 实现换行
             * 为保证自定义的一些逻辑生效（比如零宽字符的插入），Enter + Shift 希望实现通过新建 p 标签的方式完成换行
             * 此处拦截默认操作，使用新建 p 标签方式实现换行
             * Tiptap, by default, uses <br /> to create a newline character when you press Enter + Shift.
             * To ensure that some custom logic works (such as the insertion of zero-width characters), 
             * we want Enter + Shift to create a new p tag to initiate a line break.
             * This section intercepts the default operation and uses a newly created `<p>` tag to achieve line breaks.
             */
            event.preventDefault();
            const editor = this._adapter.getEditor();
            if (editor && editor.chain && editor.chain().splitBlock) {
                editor.chain().focus().splitBlock().run();
            } else if (editor && editor.view) {
                const { state, view } = editor;
                view.dispatch(state.tr.split(state.selection.from));
            }
            return true;
        }
        if (event.key !== 'Backspace') return false;
        return false;
    }

    handleDeleteContent = (content: Content) => {
        // 用于删除一些特殊内容，比如用户自定义的 slot，删除需要借助参数中的 uniqueKey
        // Used to delete some special content, such as user-defined slots. To delete, you need to use the uniqueKey in the parameter.
        const { uniqueKey } = content;
        const editor = this._adapter.getEditor();
        if (!editor) return;

        editor.commands.command(({ tr, state }) => {
            let found = false;
            state.doc.descendants((node, pos) => {
                if (node.type.name === 'referSlot' && node.attrs.uniqueKey === uniqueKey) {
                    tr.setSelection(this._adapter.createSelection(tr.doc, pos));
                    found = true;
                    return false;
                }
                return true;
            });
            if (found) {
                // Delay deletion to avoid Uncaught RangeError: Applying a mismatched transaction
                setTimeout(() => {
                    editor.view.dispatch(tr);
                    editor.commands.deleteSelection();
                }, 0);
                
                return true;
            }
            
            return false;
        });
    }

    handleFocus = (event: any) => {
        this._adapter.notifyFocus(event);
    }

    handleBlur = (event: any) => {
        this._adapter.notifyBlur(event);
    }

}
