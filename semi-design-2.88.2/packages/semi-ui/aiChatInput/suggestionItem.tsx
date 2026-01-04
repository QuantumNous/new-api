import React, { ReactNode, useCallback } from 'react';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { Suggestion, RenderSuggestionItemProps } from './interface';

const prefixCls = cssClasses.PREFIX;

interface SuggestionItemProps {
    suggestion: Suggestion;
    isActive?: boolean;
    renderSuggestionItem?: (props: RenderSuggestionItemProps) => ReactNode;
    onClick?: (suggestion: Suggestion) => void;
    index?: number;
    onMouseEnter?: (index: number) => void
}

const SuggestionItem = React.memo((props: SuggestionItemProps) => {
    const { suggestion, onClick, isActive, renderSuggestionItem, onMouseEnter, index } = props;
    const content = typeof suggestion === 'string' ? suggestion : (suggestion as any)?.content;
    const className = cls(`${prefixCls}-suggestion-item`, {
        [`${prefixCls}-suggestion-item-active`]: isActive
    });

    const handleClick = useCallback(() => {
        onClick?.(suggestion);
    }, [onClick, suggestion]);

    const handleMouseEnter = useCallback(() => {
        onMouseEnter?.(index);
    }, [index, onMouseEnter]);

    if (renderSuggestionItem) {
        return <>{renderSuggestionItem({
            suggestion, 
            className, 
            onClick: handleClick,
            onMouseEnter: handleMouseEnter
        })}</>;
    }

    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    return (<div
        className={className}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
    >
        {content}
    </div>
    );
});

export default SuggestionItem;
