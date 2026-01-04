import React, { ReactElement, ReactNode, useMemo, useCallback } from 'react';
import cls from 'classnames';
import { DialogueContentProps } from '../interface';
import MarkdownRender from '../../markdownRender';
import { cssClasses, strings } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import { Image } from '../../index';
import { FunctionToolCall, InputFile, ContentItem, InputMessage, InputText, InputImage, OutputText, Reasoning, CustomToolCall, OutputMessage, Refusal, Annotation, Reference } from '@douyinfe/semi-foundation/aiChatDialogue/foundation';
import { DialogueContentItemRenderer } from '../interface';
import { IconAlertCircle, IconCode, IconExcel, IconFile, IconImage, IconPdf, IconSendMsgStroked, IconSpin, IconVideo, IconWord, IconWrench } from '@douyinfe/semi-icons';
import { ReasoningWidget } from './contentItem/reasoning';
import { AnnotationWidget } from './contentItem/annotation';
import { ReferenceWidget } from './contentItem/reference';
import Code from './contentItem/code';
import { Locale } from '../../locale/interface';
import LocaleConsumer from "../../locale/localeConsumer";
import { messageToChatInput } from '@douyinfe/semi-foundation/aiChatDialogue/dataAdapter';

interface FileAttachmentProps extends InputFile {
    onFileClick?: (file: InputFile) => void;
    disabledFileItemClick?: boolean;
    role?: string;
    showReference?: boolean;
    onReferenceClick?: (item: Reference ) => void;
    isLastFile?: boolean
}


const { PREFIX_CONTENT } = cssClasses;
const { STATUS, MODE, ROLE, MESSAGE_ITEM_TYPE, TEXT_TYPES, TOOL_CALL_TYPES,
    DOCUMENT_TYPES, IMAGE_TYPES, PDF_TYPES, EXCEL_TYPES, CODE_TYPES, VIDEO_TYPES
} = strings;


const ImageAttachment = React.memo((props: {src: string; isList: boolean; msg: InputImage; onImageClick?: (msg: InputImage) => void; isLastImage?: boolean}) => {
    const { src, isList, msg, onImageClick, isLastImage } = props;
    return <Image 
        className={cls(`${PREFIX_CONTENT}-img`, {
            [`${PREFIX_CONTENT}-img-list`]: isList,
            [`${PREFIX_CONTENT}-img-last`]: isLastImage,
        })}
        src={src}
        onClick={() => {
            onImageClick && onImageClick(msg);
        }}
    />;
});

const FileAttachment = React.memo((props: FileAttachmentProps) => {
    const { onFileClick, disabledFileItemClick, role, onReferenceClick, showReference, isLastFile, ...restProps } = props;
    const suffix = restProps?.filename?.split('.').pop();
    const realType = suffix ?? restProps?.fileInstance?.type?.split('/').pop();

    const renderFileIcon = useCallback((type: string, props: InputFile) => {
        let icon = null;
        let typeCls = '';
    
        if (DOCUMENT_TYPES.includes(type)) {
            typeCls = 'word';
            icon = <IconWord size="extra-large" className={`${PREFIX_CONTENT}-file-icon`}/>;
        } else if (IMAGE_TYPES.includes(type)) {
            typeCls = 'image';
            icon = <div className={`${PREFIX_CONTENT}-file-icon`} style={{ backgroundImage: `url(${props.file_url})` }}/>;
        } else if (PDF_TYPES.includes(type)) {
            typeCls = 'pdf';
            icon = <IconPdf size="extra-large" className={`${PREFIX_CONTENT}-file-icon`}/>;
        } else if (EXCEL_TYPES.includes(type)) {
            typeCls = 'excel';
            icon = <IconExcel size="extra-large" className={`${PREFIX_CONTENT}-file-icon`}/>;
        } else if (CODE_TYPES.includes(type)) { 
            typeCls = 'code';
            icon = <IconCode size="extra-large" className={`${PREFIX_CONTENT}-file-icon`}/>;
        } else if (VIDEO_TYPES.includes(type)) {
            typeCls = 'video';
            icon = <IconVideo size="extra-large" className={`${PREFIX_CONTENT}-file-icon`}/>;
        } else {
            typeCls = 'default';
            icon = <IconFile size="extra-large" className={`${PREFIX_CONTENT}-file-icon`}/>;
        }
    
        return (
            <div 
                className={cls(`${PREFIX_CONTENT}-file-icon-wrapper`,
                    { [`${PREFIX_CONTENT}-file-icon-${typeCls}`]: typeCls })}
            >
                {icon}
            </div>
        );
    }, []);

    const handleFileClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        onFileClick?.(restProps);
        if (disabledFileItemClick) {
            e.preventDefault();
            return;
        }
    }, [onFileClick, disabledFileItemClick, restProps]);

    const handleReferenceClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        onReferenceClick?.({ name: restProps?.filename, url: restProps?.file_url });
        e.preventDefault();
    }, [onReferenceClick, restProps]);

    return <a
        href={restProps?.file_url}
        target="_blank"
        onClick={handleFileClick}
        className={cls(`${PREFIX_CONTENT}-file`, {
            [`${PREFIX_CONTENT}-file-last`]: isLastFile,
        })} 
        rel="noreferrer"
    >
        {renderFileIcon(realType as string, restProps)}
        <div className={`${PREFIX_CONTENT}-file-info`}>
            <span className={cls(`${PREFIX_CONTENT}-file-title`, {
                [`${PREFIX_CONTENT}-file-title-ellipsis`]: role === ROLE.USER && showReference,
            })}>{restProps?.filename}</span>
            <span className={`${PREFIX_CONTENT}-file-metadata`}>
                <span className={`${PREFIX_CONTENT}-file-type`}>{realType}</span>
                {' '}{restProps?.size}
            </span>
        </div>
        {role === ROLE.USER && showReference && (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div 
                className={`${PREFIX_CONTENT}-icon-reference`} 
                role="button" 
                tabIndex={0}
                onClick={handleReferenceClick}
            >
                <IconSendMsgStroked />
            </div>
        )}
    </a>;
});

const ToolCallWidget = React.memo((props: FunctionToolCall) => {
    const { name } = props;
    return <div className={`${PREFIX_CONTENT}-tool-call`}>
        <IconWrench />
        {name}  {props.arguments}
    </div>;
});

const DialogueContent = React.memo((props: DialogueContentProps) => {
    const { message, customRenderFunc, role: roleInfo, mode, markdownRenderProps, editing, messageEditRender, showReference,
        onFileClick, onImageClick, disabledFileItemClick, renderDialogueContentItem, onAnnotationClick, onReferenceClick } = props;
    const { content, role, status, references } = message;

    const markdownComponents = useMemo(() => ({
        'code': Code,
        ...markdownRenderProps?.components
    }), [markdownRenderProps]);


    const wrapCls = useMemo(() => {
        const isUser = role === ROLE.USER;
        const bubble = mode === MODE.BUBBLE;
        const userBubble = mode === MODE.USER_BUBBLE && isUser;
        return cls({
            [`${PREFIX_CONTENT}`]: true,
            [`${PREFIX_CONTENT}-${mode}`]: bubble || userBubble,
            [`${PREFIX_CONTENT}-no-bubble`]: !(bubble || userBubble),
            [`${PREFIX_CONTENT}-user`]: isUser,
            [`${PREFIX_CONTENT}-error`]: status === STATUS.FAILED && (bubble || userBubble)
        });
    }, [role, status, mode]);

    const customRenderer = useCallback((type: string, index: number, item: ContentItem) => {
        const customRendererFunc = renderDialogueContentItem?.[type];
        
        if (customRendererFunc) {
            let renderer: DialogueContentItemRenderer | undefined;

            // 工具调用类型可从嵌套映射按函数名优先匹配
            if (TOOL_CALL_TYPES.includes(type as any)) {
                const toolCallItem = item as FunctionToolCall | CustomToolCall;
                const functionName = toolCallItem?.name;
                if (typeof customRendererFunc === 'object' && functionName) {
                    const nestedRenderer = (customRendererFunc as Record<string, DialogueContentItemRenderer>)?.[functionName];
                    if (nestedRenderer) {
                        renderer = nestedRenderer;
                    }
                }
            }

            // 兜底：如果没有匹配到嵌套渲染器且本身是函数，则使用之
            if (!renderer && typeof customRendererFunc === 'function') {
                renderer = customRendererFunc as DialogueContentItemRenderer;
            }

            if (renderer) {
                return <div className={`${PREFIX_CONTENT}-custom-renderer`} key={`index-${index}`}>{renderer(item, message)}</div>;
            }
        }
        return null;
    }, [renderDialogueContentItem, message]);

    const renderMarkdown = useCallback((text: string, key: React.Key) => {
        if (text !== '') {
            return <div className={wrapCls} key={key}>
                <MarkdownRender
                    format='md'
                    raw={text}
                    components={markdownComponents as any}
                    {...markdownRenderProps}
                />
                {
                    role === ROLE.USER && showReference && (
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                        <div 
                            className={`${PREFIX_CONTENT}-icon-reference`} 
                            role="button" 
                            tabIndex={0}
                            onClick={() => onReferenceClick?.({ type: 'text', content: text })}
                        >
                            <IconSendMsgStroked />
                        </div>)
                }
            </div>;
        }
        return null;
    }, [wrapCls, markdownComponents, markdownRenderProps, role, onReferenceClick, showReference]);

    const renderMessage = useCallback((msg: InputMessage | OutputMessage, index: number) => {
        if (typeof msg.content === 'string') {
            return renderMarkdown(msg.content, `msg-${index}`);
        }
        const inner = (msg.content ?? []) as Array<InputText | InputImage | InputFile | OutputText>;
        const isImageList = inner.filter(i => i?.type === MESSAGE_ITEM_TYPE.INPUT_IMAGE).length > 1;

        return inner.map((i, innerIdx) => {
            const customNode = customRenderer(i?.type as string, index, i);

            if (customNode) return customNode;

            if (TEXT_TYPES.includes(i?.type as string)) {
                const annotation = (i as OutputText).annotations;
                // 过滤掉 file_citation 和 container_file_citation 类型的 annotation
                const filteredAnnotation = annotation && annotation.length > 0 && annotation.filter((item: Annotation) => (item.type !== 'file_citation' && item.type !== 'container_file_citation'));
                return (
                    <React.Fragment key={`msg-${index}-${innerIdx}`}>
                        {filteredAnnotation && filteredAnnotation.length > 0 &&
                            <AnnotationWidget 
                                annotation={filteredAnnotation} 
                                // todo: 需要支持动态配置
                                maxCount={15}
                                onClick={() => onAnnotationClick(filteredAnnotation)}
                            />
                        }
                        {renderMarkdown((i as InputText | OutputText).text || '', `msg-${index}-${innerIdx}`)}
                        {renderMarkdown((i as Refusal).refusal || '', `msg-${index}-${innerIdx}-refusal`)}
                    </React.Fragment>
                );
            }
            if (i?.type === MESSAGE_ITEM_TYPE.INPUT_IMAGE) {
                const nextItemType = inner[innerIdx + 1]?.type;
                const isLastImage = innerIdx === inner.length - 1 || nextItemType === MESSAGE_ITEM_TYPE.INPUT_FILE;
                return (
                    <React.Fragment key={`msg-${index}-${innerIdx}`}>
                        <ImageAttachment 
                            src={(i as InputImage).image_url} 
                            isList={isImageList} msg={i as InputImage} 
                            onImageClick={onImageClick}
                            isLastImage={isLastImage}
                        />   
                        {
                            nextItemType === MESSAGE_ITEM_TYPE.INPUT_FILE && <br />
                        }
                    </React.Fragment>
                );
            }
            if (i?.type === MESSAGE_ITEM_TYPE.INPUT_FILE) {
                const nextItemType = inner[innerIdx + 1]?.type;
                const isLastFile = innerIdx === inner.length - 1 || nextItemType === MESSAGE_ITEM_TYPE.INPUT_IMAGE;
                return (
                    <React.Fragment key={`msg-${index}-${innerIdx}`}>
                        <FileAttachment 
                            {...i as InputFile} 
                            onFileClick={onFileClick} 
                            disabledFileItemClick={!!disabledFileItemClick} 
                            role={role} 
                            onReferenceClick={onReferenceClick} 
                            showReference={showReference}
                            isLastFile={isLastFile}
                        />
                        {
                            nextItemType === MESSAGE_ITEM_TYPE.INPUT_IMAGE && <br />
                        }
                    </React.Fragment>
                );
            }
            return null;
        });
    }, [renderMarkdown, customRenderer, onAnnotationClick, onImageClick, onFileClick, disabledFileItemClick, role, onReferenceClick, showReference]);

    const renderToolCall = useCallback((item: ContentItem, index: number) => (
        <ToolCallWidget key={`tool-${index}`} {...(item as FunctionToolCall | CustomToolCall)} />
    ), []);

    const builtinRenderers = useMemo(() => ({
        [MESSAGE_ITEM_TYPE.MESSAGE]: (item: ContentItem, index: number) => renderMessage(item as InputMessage | OutputMessage, index),
        [MESSAGE_ITEM_TYPE.REASONING]: (item: ContentItem, index: number) => (
            <ReasoningWidget 
                key={`reason-${index}`} 
                summary={(item as Reasoning).summary}
                content={(item as Reasoning).content}
                status={(item as Reasoning).status}
                markdownRenderProps={markdownRenderProps}
            />
        ),
        [MESSAGE_ITEM_TYPE.FUNCTION_CALL ]: renderToolCall,
        [MESSAGE_ITEM_TYPE.CUSTOM_TOOL_CALL]: renderToolCall,
    } as Record<string, (item: ContentItem, index: number) => React.ReactNode>), [renderMessage, markdownRenderProps, renderToolCall]);

    const loadingNode = useMemo(() => {
        const isLoading = [STATUS.QUEUED, STATUS.IN_PROGRESS, STATUS.INCOMPLETE].includes(status);
        const isOutputExist = (content && content?.length > 0) || message.output_text;
        // 如果内容为空，且没有 output_text，则显示 loading
        // If the content is empty and there is no output_text, it will display loading
        if (isLoading && !isOutputExist) {
            return <span className={`${PREFIX_CONTENT}-loading`} >
                <span className={`${PREFIX_CONTENT}-loading-item`} /> 
                <span className={`${PREFIX_CONTENT}-loading-item`} /> 
                <span className={`${PREFIX_CONTENT}-loading-item`} /> 
                <span className={`${PREFIX_CONTENT}-loading-text`}>
                    <LocaleConsumer<Locale["AIChatDialogue"]> componentName="AIChatDialogue" >
                        {(locale: Locale["AIChatDialogue"]) => locale['loading']}
                    </LocaleConsumer>
                </span>
            </span>;
        } else {
            return null;
        }
    }, [status, content, message.output_text]);

    const node = useMemo(() => {
        if (editing) {
            return messageEditRender?.(messageToChatInput(message));
        } else {
            let realContent: ReactNode | ReactNode[];
            const textContent = typeof content === 'string' ? content : message.output_text;
            
            if (textContent) {
                const defaultRenderer = renderDialogueContentItem?.['default'];
                if (typeof defaultRenderer === 'function') {
                    realContent = <div className={`${PREFIX_CONTENT}-custom-renderer`}>{defaultRenderer(textContent, message)}</div>;
                } else {
                    realContent = <div className={wrapCls}>
                        <MarkdownRender
                            format='md'
                            raw={textContent}
                            components={markdownComponents as any}
                            {...markdownRenderProps}
                        />
                        {role === ROLE.USER && showReference && (
                            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                            <div 
                                className={`${PREFIX_CONTENT}-icon-reference`} 
                                role="button" 
                                tabIndex={0}
                                onClick={() => onReferenceClick?.({ type: 'text', content: textContent })}
                            >
                                <IconSendMsgStroked />
                            </div>
                        )}
                    </div>;
                }
            } else if (Array.isArray(content)) {
                realContent = content.map((item: ContentItem, index) => {
                    const typeKey = item?.type as string | undefined;
                    const effectiveType = typeKey ?? MESSAGE_ITEM_TYPE.MESSAGE;

                    // User defined rendering first
                    const customNode = customRenderer(effectiveType, index, item);
                    if (customNode) return customNode;

                    // Then builtin rendering
                    const renderer = builtinRenderers[effectiveType];
                    if (renderer) return renderer(item, index);
                    return null;
                });
            }
            return (
                <div className={`${PREFIX_CONTENT}-wrapper`}>
                    {(status === STATUS.FAILED || status === STATUS.CANCELLED) && <div className={`${PREFIX_CONTENT}-failed`}>
                        <IconAlertCircle />
                    </div>}
                    <div className={`${PREFIX_CONTENT}-inner`}>{realContent}</div>
                </div>
            );
        }
    }, [status, content, editing, message, role, messageEditRender, markdownRenderProps, wrapCls, 
        markdownComponents, builtinRenderers, customRenderer, renderDialogueContentItem, showReference, onReferenceClick]);
        
    if (customRenderFunc) {
        return customRenderFunc({ 
            message, 
            role: roleInfo,
            defaultContent: node,
            className: wrapCls,
        }) as ReactElement;
    } else {
        return <div className={cls(`${PREFIX_CONTENT}`, {
            [`${PREFIX_CONTENT}-editing`]: editing,
        })}>
            {references && references.length > 0 && !editing && <ReferenceWidget references={references} />}
            {node}
            {loadingNode}
        </div>; 
    } 
});

export default DialogueContent;
