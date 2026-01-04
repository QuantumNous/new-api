/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import BaseComponent from '../_base/baseComponent';
import { AIChatInputProps, AIChatInputState, Skill, Attachment, Reference, Content, LeftMenuChangeProps } from './interface';
import { noop, isEqual } from 'lodash';
import { cssClasses, numbers } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { Popover, Tooltip, Upload, Progress } from '../index';
import { IconSendMsgStroked, IconFile, IconCode, IconCrossStroked, 
    IconPaperclip, IconArrowUp, IconStop, IconClose, IconTemplateStroked, 
    IconMusic, IconVideo, IconPdf, IconWord, IconExcel,
    IconSize
} from '@douyinfe/semi-icons';
import '@douyinfe/semi-foundation/aiChatInput/aiChatInput.scss';
import HorizontalScroller from './horizontalScroller';
import cls from 'classnames';
import { getAttachmentType, isImageType, getContentType, getCustomSlotAttribute } from '@douyinfe/semi-foundation/aiChatInput/utils';
import Configure from './configure';
import RichTextInput from './richTextInput';
import { Editor, FocusPosition } from '@tiptap/core';
import { getUuidShort } from '@douyinfe/semi-foundation/utils/uuid';
import { throttle } from 'lodash';
import AIChatInputFoundation, { AIChatInputAdapter } from '@douyinfe/semi-foundation/aiChatInput/foundation';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { Node } from 'prosemirror-model';
import ConfigContext, { ContextValue } from '../configProvider/context';
import getConfigureItem from './configure/getConfigureItem';
import { MessageContent } from '@douyinfe/semi-foundation/aiChatInput/interface';
import { Content as TiptapContent } from "@tiptap/core";
import { Locale } from '../locale/interface';
import LocaleConsumer from '../locale/localeConsumer';
import SkillItem from './skillItem';
import SuggestionItem from './suggestionItem';

export { getConfigureItem };
export * from './interface';

const prefixCls = cssClasses.PREFIX;

class AIChatInput extends BaseComponent<AIChatInputProps, AIChatInputState> {

    static __SemiComponentName__ = "AIChatInput";
    static Configure = Configure;
    static contextType = ConfigContext;
    static getCustomSlotAttribute = getCustomSlotAttribute;

    private clickOutsideHandler: (e: Event) => void | null;

    static defaultProps: Partial<AIChatInputProps> = {
        onContentChange: noop,
        onStopGenerate: noop,
        showReference: true,
        showUploadFile: true,
        generating: false,
        dropdownMatchTriggerWidth: true,
        round: true,
        topSlotPosition: 'top',
    }

    constructor(props: AIChatInputProps) {
        super(props);
        this.editor = null;
        const defaultAttachment = props?.uploadProps?.defaultFileList ?? [];
        this.state = {
            popupKey: 1,
            templateVisible: false,
            skillVisible: false,
            suggestionVisible: false,
            attachments: defaultAttachment,
            content: null,
            popupWidth: null,
            skill: undefined,
            activeSkillIndex: 0,
            activeSuggestionIndex: 0,
            /**
             * richTextInit 用于标识富文本编辑区是否初始化完成，会影响初始化时发送按钮是否可以点击
             * richTextInit is used to identify whether the rich text editing area has been initialized,
             * which will affect whether the send button can be clicked during initialization.
             */
            richTextInit: false,
        };
        this.triggerRef = React.createRef();
        this.popUpOptionListID = getUuidShort();
        this.foundation = new AIChatInputFoundation(this.adapter);
        this.transformedContent = [];
        this.uploadRef = React.createRef();
        this.configureRef = React.createRef();
        this.richTextDIVRef = React.createRef<HTMLDivElement>();
        this.suggestionPanelRef = React.createRef<HTMLDivElement>(); 
        this.clickOutsideHandler = null;
    }

    editor: Editor;
    triggerRef: React.RefObject<HTMLDivElement>;
    configureRef: React.RefObject<Configure>;
    popUpOptionListID: string;
    foundation: AIChatInputFoundation;
    transformedContent: Content[]; 
    context: ContextValue;
    uploadRef: React.RefObject<Upload>;
    richTextDIVRef = React.createRef<HTMLDivElement>();
    suggestionPanelRef = React.createRef<HTMLDivElement>(); 

    get adapter(): AIChatInputAdapter<AIChatInputProps, AIChatInputState> {
        return {
            ...super.adapter,
            reposPopover: throttle(() => {
                const { templateVisible } = this.state;
                if (templateVisible) {
                    this.setState({
                        popupKey: this.state.popupKey + 1,
                    }); 
                }
            }, 200),
            setContent: (content: string) => {
                this.editor.commands.setContent(content);
            },
            clearContent: () => {
                this.setContent('');
            },
            clearAttachments: () => {
                this.setState({
                    attachments: [],
                });
            },
            focusEditor: (pos?: FocusPosition) => {
                this.editor?.commands.focus(pos || 'end');
            },
            getTriggerWidth: () => {
                const el = this.triggerRef.current;
                return el && el.getBoundingClientRect().width;
            },
            getEditor: () => this.editor,
            getPopupID: () => this.popUpOptionListID,
            notifySkillChange: (skill: Skill) => {
                this.props.onSkillChange?.(skill);
            },
            notifyContentChange: (result: Content[]) => {
                this.transformedContent = result;
                this.props.onContentChange?.(result);
            },
            notifyConfigureChange: (value: LeftMenuChangeProps, changedValue: LeftMenuChangeProps) => {
                this.props.onConfigureChange?.(value, changedValue);
            },
            manualUpload: (files: File[]) => {
                const uploadComponent = this.uploadRef.current;
                if (uploadComponent) {
                    uploadComponent.insert(files);
                }
            },
            notifyMessageSend: (props: MessageContent) => {
                this.props.onMessageSend?.(props);
            },
            notifyStopGenerate: () => {
                this.props.onStopGenerate?.();
            },
            getRichTextDiv: () => this.richTextDIVRef?.current,
            registerClickOutsideHandler: cb => {
                const clickOutsideHandler = (e: Event) => {
                    const optionsDom = this.suggestionPanelRef && this.suggestionPanelRef.current;
                    const triggerDom = this.triggerRef && this.triggerRef.current;
                    const target = e.target as Element;
                    const path = e.composedPath && e.composedPath() || [target];
                    if (
                        optionsDom &&
                        (!optionsDom.contains(target) || !optionsDom.contains(target.parentNode)) &&
                        triggerDom &&
                        !triggerDom.contains(target) &&
                        !(path.includes(triggerDom) || path.includes(optionsDom))
                    ) {
                        cb(e);
                    }
                };
                this.clickOutsideHandler = clickOutsideHandler;
                document.addEventListener('mousedown', clickOutsideHandler, false);
            },
            unregisterClickOutsideHandler: () => {
                if (this.clickOutsideHandler) {
                    document.removeEventListener('mousedown', this.clickOutsideHandler, false);
                }
            },
            handleReferenceDelete: (reference: Reference) => {
                this.props.onReferenceDelete?.(reference);
            },
            handleReferenceClick: (reference: Reference) => {
                this.props.onReferenceClick?.(reference);
            },
            isSelectionText: (selection: Selection) => {
                return selection instanceof TextSelection;
            },
            createSelection: (node: Node, pos: number) => {
                return NodeSelection.create(node, pos);
            },
            notifyFocus: (event: any) => {
                this.props.onFocus?.(event);
            },
            notifyBlur: (event: any) => {
                this.props.onBlur?.(event);
            },
            getConfigureValue: () => {
                return this.configureRef?.current?.getConfigureValue();
            }
        };
    }

    componentDidUpdate(prevProps: Readonly<AIChatInputProps>): void {
        const { suggestions } = this.props;
        if (!isEqual(suggestions, prevProps.suggestions)) {
            const newVisible = (suggestions && suggestions.length > 0) ? true : false;
            newVisible ? this.foundation.showSuggestionPanel() :
                this.foundation.hideSuggestionPanel();
        }
        if (this.props.generating && (this.props.generating !== prevProps.generating)) {
            this.adapter.clearContent();
            this.adapter.clearAttachments();
        }
    }

    componentWillUnmount(): void {
        this.foundation.destroy();
    }

    // ref method
    setContent = (content: TiptapContent) => {
        this.adapter.setContent(content);
    };

    // ref method
    focusEditor = (pos: FocusPosition) => {
        this.adapter.focusEditor(pos);
    }

    // ref method & inner method
    changeTemplateVisible = (value: boolean) => {
        this.foundation.changeTemplateVisible(value);
    }

    // ref method & inner method
    getEditor = () => this.editor;

    // ref method
    deleteContent(content: Content) {
        this.foundation.handleDeleteContent(content);
    }

    setEditor = (editor: Editor) => {
        this.editor = editor;
    }

    setContentWhileSaveTool = (content: string) => {
        const { skill } = this.state;
        let realContent = '';
        if (!skill) {
            realContent = `<p>${content}</p>`;
        } else {
            realContent = `<p><skill-slot data-value=${skill.label ?? 'test'}></skill-slot>${content}</p>`;
        }
        this.setContent(realContent);
    }

    renderTemplate() {
        const { skill } = this.state;
        const { renderTemplate, templatesStyle, templatesCls } = this.props;
        const { popupWidth } = this.state;
        return <div
            className={cls(`${prefixCls}-template`, {
                [templatesCls]: templatesCls,
            })} 
            style={{ width: popupWidth, maxHeight: 500, ...templatesStyle }}
        >
            {renderTemplate?.(skill, this.setContent)}
        </div>;
    }

    renderSkill() {
        const { popupWidth } = this.state;
        const { skills, renderSkillItem } = this.props;
        return <div 
            id={`${prefixCls}-skill-${this.popUpOptionListID}`}
            className={`${prefixCls}-skill`} 
            style={{ width: popupWidth, maxHeight: numbers.SKILL_MAX_HEIGHT }}
        >
            {
                skills?.map((item, index) => (<SkillItem
                    index={index}
                    isActive={this.state.activeSkillIndex === index}
                    key={item.key || item.value} 
                    skill={item}
                    renderSkillItem={renderSkillItem}
                    onClick={this.foundation.handleSkillSelect}
                    onMouseEnter={this.foundation.setActiveSkillIndex}
                />))
            }
        </div>;
    }

    renderSuggestions() {
        const { suggestions, renderSuggestionItem } = this.props;
        const { popupWidth, activeSuggestionIndex } = this.state;
        return (<div 
            id={`${prefixCls}-suggestion-${this.popUpOptionListID}`}
            className={`${prefixCls}-suggestion`}
            style={{ width: popupWidth, maxHeight: numbers.SUGGESTION_MAX_HEIGHT }}
            ref={this.suggestionPanelRef}
        >
            {
                suggestions.map((item, index) => (
                    <SuggestionItem
                        index={index}
                        key={typeof item === 'string' ? item : (item && 'content' in item ? item.content : index)}
                        suggestion={item}
                        isActive={activeSuggestionIndex === index}
                        renderSuggestionItem={renderSuggestionItem}
                        onClick={this.foundation.handleSuggestionSelect}
                        onMouseEnter={this.foundation.setActiveSuggestionIndex}
                    />
                ))
            }
        </div>
        );
    }

    renderPopoverContent() {
        const { templateVisible, skillVisible, suggestionVisible } = this.state;
        if (templateVisible) {
            return this.renderTemplate();
        } else if (skillVisible) {
            return this.renderSkill();
        } else if (suggestionVisible) {
            return this.renderSuggestions();
        } else {
            return null;
        }
    }

    handleReferenceDelete = (reference: Reference) => {
        const { onReferenceDelete } = this.props;
        onReferenceDelete(reference);
    }

    getIconByType(type: string, size: IconSize = 'small') {
        let iconNode: React.ReactNode;
        if (type === 'text') {
            return null;
        }
        switch (type) {
            case 'file':
            case 'word':
                iconNode = <IconWord size={size} />;
                break;
            case 'code':
                iconNode = <IconCode size={size} />;
                break;
            case 'excel':
                iconNode = <IconExcel size={size} />;
                break;
            case 'video':
                iconNode = <IconVideo size={size} />;
                break;
            case 'audio':
                iconNode = <IconMusic size={size} />;
                break;
            case 'pdf': 
                iconNode = <IconPdf size={size} />;
                break;
            default:
                iconNode = <IconFile size={size} />;
                break;
        }
        return iconNode;
    }

    getReferenceIconByType(type: string) {
        let iconNode = this.getIconByType(type);
        return <span className={`${prefixCls}-ref-icon ${prefixCls}-ref-icon-${type} ${prefixCls}-reference-icon`}>
            {iconNode}
        </span>;
    }

    getAttachmentIconByType(type: string) {
        let iconNode = this.getIconByType(type, 'large');
        return <span className={`${prefixCls}-attachment-icon ${prefixCls}-ref-icon ${prefixCls}-ref-icon-${type}`}>
            {iconNode}
        </span>;
    }

    renderReference() {
        const { references = [], renderReference } = this.props;
        if (references.length === 0 ) {
            return null;
        }
        return <div className={`${prefixCls}-references`}>
            {references.map(item => {
                if (renderReference) {
                    return renderReference(item);
                }
                const { id, type, content, name, url } = item;
                const isImage = isImageType(item);
                const signIconType = getContentType(getAttachmentType(item));
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                return <div 
                    key={id} 
                    className={`${prefixCls}-reference`} 
                    onClick={() => { this.foundation.handleReferenceClick(item);}}
                >
                    <IconSendMsgStroked />
                    <span className={`${prefixCls}-reference-content`}>
                        {type !== 'text' && ( isImage ? <img className={`${prefixCls}-reference-img`} src={url} alt={name}></img> :
                            this.getReferenceIconByType(signIconType))}
                        <span className={`${prefixCls}-reference-name`}>{type === 'text' ? content : name}</span>
                    </span>
                    <IconCrossStroked 
                        size="small" 
                        className={`${prefixCls}-reference-delete`}
                        onClick={(e) => {
                            this.handleReferenceDelete(item);
                            e.stopPropagation();
                        }}
                    />
                </div>;
            })}
        </div>;
    }

    // ref method
    deleteUploadFile = (item: Attachment) => {
        this.foundation.handleUploadFileDelete(item);
    }

    renderAttachment() {
        const { attachments = [] } = this.state;
        if (attachments.length === 0) {
            return null;
        }
        return <HorizontalScroller prefix={`${prefixCls}`}>
            {attachments?.map((item: Attachment, index: number) => {
                const isImage = isImageType(item);
                const realType = getAttachmentType(item);
                const signIconType = getContentType(realType);
                const { uid, name, url, size, percent, status } = item;
                const showPercent = !(percent === 100 || typeof percent === 'undefined') && status === 'uploading';
                return <div className={`${prefixCls}-attachment`} key={uid}>
                    {isImage ? <img className={`${prefixCls}-attachment-img`} src={url} alt={name}></img>
                        : this.getAttachmentIconByType(signIconType)
                    }
                    <div className={`${prefixCls}-attachment-content`}>
                        <div className={`${prefixCls}-attachment-content-name`}>{name}</div>
                        <div className={`${prefixCls}-attachment-content-size`}>{`${realType} ${size}`}</div>
                    </div>
                    {showPercent && <Progress 
                        type="circle" 
                        width={30}
                        className={`${prefixCls}-attachment-progress`} 
                        percent={percent} 
                        showInfo={false}
                        aria-label="upload progress"
                    />}
                    <IconClose 
                        className={`${prefixCls}-attachment-delete`} 
                        size="small" 
                        onClick={() => { this.foundation.handleUploadFileDelete(item);}} 
                    />
                </div>;
            }
            )}
        </HorizontalScroller>;
    }

    renderTopArea() {
        const { references, topSlotPosition, renderTopSlot, showReference, showUploadFile } = this.props;
        const { attachments } = this.state;
        const topSlot = renderTopSlot?.({
            references,
            attachments,
            content: this.transformedContent,
            handleUploadFileDelete: this.foundation.handleUploadFileDelete,
            handleReferenceDelete: this.handleReferenceDelete,
        });

        return <>
            {topSlotPosition === 'top' && topSlot}
            {showReference && this.renderReference()}
            {topSlotPosition === 'middle' && topSlot}
            {showUploadFile && this.renderAttachment()}
            {topSlotPosition === 'bottom' && topSlot}
        </>;
    }

    renderLeftFooter = () => {
        const { renderConfigureArea, round, showTemplateButton } = this.props;
        const { skill = {} } = this.state;
        const { hasTemplate } = skill as Skill;
        return <LocaleConsumer componentName="AIChatInput">
            {(locale: Locale['AIChatInput']) => (
                <div className={`${prefixCls}-footer-configure`}>
                    <Configure 
                        ref={this.configureRef}
                        round={round}
                        onChange={this.foundation.onConfigureChange} 
                    >
                        {renderConfigureArea?.()}
                        {(showTemplateButton || hasTemplate) && <Configure.Button
                            key={"template"}
                            field="template"
                            onClick={this.changeTemplateVisible}
                            icon={<IconTemplateStroked />} 
                        >{locale.template}</Configure.Button>}
                    </Configure>
                </div>)}
        </LocaleConsumer>;
    }

    renderUploadButton = () => {
        const { uploadTipProps, uploadProps } = this.props;
        const { attachments } = this.state;
        const { className, onChange, renderFileItem, children, ...rest } = uploadProps ?? {};
        const realUploadProps = {
            ...rest,
            onChange: this.foundation.onUploadChange,
        };
        const uploadNode = <Upload
            ref={this.uploadRef}
            fileList={attachments}
            listType="none" 
            {...realUploadProps}
            key='upload'
        >
            <button className={`${prefixCls}-footer-action-button ${prefixCls}-footer-action-upload`} >
                <IconPaperclip />
            </button>
        </Upload>;

        return uploadTipProps ? <Tooltip {...uploadTipProps} key='upload'><span>{uploadNode}</span></Tooltip> : uploadNode;
    }

    renderSendButton = () => {
        const { generating } = this.props;
        const canSend = this.foundation.canSend();
        return <button
            key="send" 
            className={cls(`${prefixCls}-footer-action-button`, {
                [`${prefixCls}-footer-action-send`]: !generating,
                [`${prefixCls}-footer-action-stop`]: generating,
                [`${prefixCls}-footer-action-send-disabled`]: !generating && !canSend,
            })}
            onClick={this.foundation.handleSend}
        >
            {generating ? <IconStop /> : <IconArrowUp />}
        </button>;
    }

    renderRightFooter = () => {
        const { renderActionArea } = this.props;
        const actionCls = `${prefixCls}-footer-action`;
        const actionNode = [
            this.renderUploadButton(),
            this.renderSendButton(),
        ];
        if (renderActionArea) {
            return renderActionArea({
                menuItem: actionNode,
                className: actionCls
            });
        }
        return <div className={actionCls}>
            {actionNode}
        </div>;
    }

    renderFooter = () => {
        const round = this.props.round;
        return <div className={cls(`${prefixCls}-footer`, { [`${prefixCls}-footer-round`]: round })}>
            {this.renderLeftFooter()}
            {this.renderRightFooter()}
        </div>;
    }

    render() {
        const { direction } = this.context;
        const defaultPosition = direction === 'rtl' ? 'bottomRight' : 'bottomLeft';
        const { style, className, popoverProps, placeholder, extensions, defaultContent } = this.props;
        const { templateVisible, skillVisible, suggestionVisible, popupKey } = this.state;
       
        return (
            <Popover
                position={defaultPosition}
                {...popoverProps}
                rePosKey={popupKey}
                className={cls({
                    [`${prefixCls}-popover-suggestion`]: suggestionVisible,
                    [`${prefixCls}-popover-skill`]: skillVisible,
                    [`${prefixCls}-popover-template`]: templateVisible,
                })}
                content={this.renderPopoverContent()}
                visible={templateVisible || skillVisible || suggestionVisible}
                trigger="custom"
                disableArrowKeyDown={true}
            >
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                <div 
                    className={cls(prefixCls, { [className]: className })} 
                    style={style}
                    ref={this.triggerRef}
                    onClick={this.foundation.handleContainerClick}
                    onMouseDown={this.foundation.handleContainerMouseDown}
                >
                    {this.renderTopArea()}
                    <RichTextInput
                        innerRef={this.richTextDIVRef}
                        defaultContent={defaultContent}
                        placeholder={placeholder}
                        onKeyDown={this.foundation.handleKeyDown} 
                        setEditor={this.setEditor}
                        onChange={this.foundation.handleContentChange}
                        extensions={extensions}
                        handleKeyDown={this.foundation.handRichTextArealKeyDown}
                        onPaste={this.foundation.handlePaste}
                        onFocus={this.foundation.handleFocus}
                        onBlur={this.foundation.handleBlur}
                        handleCreate={this.foundation.handleCreate}
                    />
                    {this.renderFooter()}
                </div>
            </Popover>
        );
    }
}

export default AIChatInput;