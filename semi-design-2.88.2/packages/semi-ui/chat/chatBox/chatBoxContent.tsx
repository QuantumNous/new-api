import React, { ReactElement, ReactNode, useMemo } from 'react';
import cls from 'classnames';
import { Message, Metadata, RenderContentProps, MarkdownRenderProps } from '../interface';
import MarkdownRender from '../../markdownRender';
import { cssClasses, strings } from '@douyinfe/semi-foundation/chat/constants';
import { MDXProps } from 'mdx/types';
import { FileAttachment, ImageAttachment } from '../attachment';
import Code from './code';

const { PREFIX_CHAT_BOX } = cssClasses;
const { MESSAGE_STATUS, MODE, ROLE } = strings;

interface ChatBoxContentProps {
    mode?: 'bubble' | 'noBubble' | 'userBubble';
    customMarkDownComponents?: MDXProps['components'];
    children?: string;
    role?: Metadata;
    message?: Message;
    customRenderFunc?: (props: RenderContentProps) => ReactNode;
    markdownRenderProps?: MarkdownRenderProps
}

const ChatBoxContent = (props: ChatBoxContentProps) => {
    const { message = {}, customRenderFunc, role: roleInfo, customMarkDownComponents, mode, markdownRenderProps } = props;
    const { content, role, status } = message;

    const markdownComponents = useMemo(() => ({
        'code': Code,
        'SemiFile': FileAttachment,
        'img': ImageAttachment,
        ...customMarkDownComponents
    }), [customMarkDownComponents]);

    const wrapCls = useMemo(() => {
        const isUser = role === ROLE.USER;
        const bubble = mode === MODE.BUBBLE;
        const userBubble = mode === MODE.USER_BUBBLE && isUser;
        return cls(`${PREFIX_CHAT_BOX}-content`, {
            [`${PREFIX_CHAT_BOX}-content-${mode}`]: bubble || userBubble,
            [`${PREFIX_CHAT_BOX}-content-user`]: (bubble && isUser) || userBubble,
            [`${PREFIX_CHAT_BOX}-content-error`]: status === MESSAGE_STATUS.ERROR && (bubble || userBubble)
        });
    }, [role, status, mode]);

    const node = useMemo(() => {
        if (status === MESSAGE_STATUS.LOADING) {
            return <span className={`${PREFIX_CHAT_BOX}-content-loading`} >
                <span className={`${PREFIX_CHAT_BOX}-content-loading-item`} />
            </span>;
        } else {
            let realContent;
            if (typeof content === 'string') {
                realContent = <MarkdownRender
                    format='md'
                    raw={content}
                    components={markdownComponents as any}
                    {...markdownRenderProps}
                />;
            } else if (Array.isArray(content)) {
                realContent = content.map((item, index) => {
                    if (item.type === 'text') {
                        return <MarkdownRender
                            key={`index`}
                            format='md'
                            raw={item.text}
                            components={markdownComponents as any}
                            {...markdownRenderProps}
                        />;
                    } else if (item.type === 'image_url') {
                        return <ImageAttachment key={`index`} src={item.image_url.url} />;
                    } else if (item.type === 'file_url') {
                        const { name, size, url, type } = item.file_url;
                        const realType = name.split('.').pop() ?? type?.split('/').pop();
                        return <FileAttachment key={`index`} url={url} name={name} size={size} type={realType}></FileAttachment>;
                    }
                    return null;
                });
            }
            return (<>
                {realContent}
            </>);
        }
    }, [status, content]);
        
    if (customRenderFunc) {
        return customRenderFunc({ 
            message, 
            role: roleInfo,
            defaultContent: node,
            className: wrapCls,
        }) as ReactElement;
    } else {
        return <div className={wrapCls}>{node}</div>; 
    } 
};

export default ChatBoxContent;
