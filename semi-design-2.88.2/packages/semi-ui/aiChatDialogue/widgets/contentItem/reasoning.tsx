import React, { useState, useCallback } from 'react';
import Collapsible from '../../../collapsible';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import { IconChevronDown, IconChevronUp, IconAISearchLevel2 } from '@douyinfe/semi-icons';
import MarkdownRender from '../../../markdownRender';
import { MarkdownRenderProps } from '../../../aiChatDialogue/interface';
import LocaleConsumer from '../../../locale/localeConsumer';
import { Locale } from "../../../locale/interface";


export interface ReasoningWidgetProps {
    status?: string;
    summary?: { text?: string; type?: string }[];
    content?: { text?: string; type?: string }[];
    markdownRenderProps?: MarkdownRenderProps;
    customRenderer?: (props: ReasoningWidgetProps) => React.ReactNode
}

const prefixCls = cssClasses.PREFIX_REASONING;

export const ReasoningWidget = (props: ReasoningWidgetProps) => {
    const { status, summary, content, markdownRenderProps, customRenderer } = props;
    const defaultOpen = status !== 'completed';
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const handleClick = useCallback(() => {
        setIsOpen(!isOpen);
    }, [isOpen]);

    const getText = useCallback(() => {
        if (summary && summary.length > 0) {
            return summary.map((item: { text?: string; type?: string }) => item.text).join('\n');
        } else if (content && content.length > 0) {
            return content.map((item: { text?: string; type?: string }) => item.text).join('\n');
        }
        return '';
    }, [summary, content]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    }, [handleClick]);

    return (
        <div 
            role="button"
            tabIndex={0}
            className={`${prefixCls}-wrapper`} 
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            <div className={`${prefixCls}-header`}>
                <div className={`${prefixCls}-header-prefix`}>
                    <IconAISearchLevel2 />
                </div>
                <div className={`${prefixCls}-header-title`}>
                    <LocaleConsumer<Locale["AIChatDialogue"]> componentName="AIChatDialogue" >
                        {(locale: Locale["AIChatDialogue"]) => (status === 'completed' ? locale['reasoning']['completed'] : locale['reasoning']['thinking'])}
                    </LocaleConsumer>
                </div>
                <div className={`${prefixCls}-header-suffix`}>
                    {isOpen ? <IconChevronUp onClick={handleClick}/> : <IconChevronDown onClick={handleClick}/>}
                </div>
            </div>
            <Collapsible 
                isOpen={isOpen}
            >
                <div className={`${prefixCls}-content`}>
                    {customRenderer ? customRenderer(props) : (
                        <MarkdownRender
                            format='md'
                            raw={getText()}
                            {...markdownRenderProps}
                        />
                    )}
                </div>
            </Collapsible>
        </div>
    );
};