import React, { useState, useCallback, useEffect } from 'react';
import { Step } from '@douyinfe/semi-foundation/aiChatDialogue/foundation';
import Collapsible from '../../../collapsible';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
import { IconStoryStroked, IconChevronDown, IconChevronUp, IconMore, IconSearch } from '@douyinfe/semi-icons';

const prefixCls = cssClasses.PREFIX_STEP;
const { PREFIX_CONTENT } = cssClasses;

export interface DialogueStepWidgetProps {
    steps: Step[]
}

export const DialogueStepWidget = (props: DialogueStepWidgetProps) => {
    const [openIndexes, setOpenIndexes] = useState<Set<number>>(() => new Set(props.steps.map((_, i) => i)));

    useEffect(() => {
        setOpenIndexes(new Set(props.steps.map((_, i) => i)));
    }, [props.steps]);

    const toggleOpen = useCallback((idx: number) => {
        setOpenIndexes(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    }, []);

    const completedIcon = () => {
        return <IconStoryStroked className={`${prefixCls}-completed`}/>;
    };

    const loadingIcon = () => {
        return <span className={`${PREFIX_CONTENT}-loading`}>
            <span className={`${PREFIX_CONTENT}-loading-item`} /> 
            <span className={`${PREFIX_CONTENT}-loading-item`} /> 
            <span className={`${PREFIX_CONTENT}-loading-item`} /> 
        </span>;
    };


    return (
        <div className={`${prefixCls}-wrapper`}>
            {props.steps.map((item: Step, index) => {
                const { summary, status, actions } = item;
                const isOpen = openIndexes.has(index);
                const actionsLength = actions?.length;
                return (
                    <React.Fragment key={index}>
                        <div 
                            className={`${prefixCls}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleOpen(index)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleOpen(index);
                                }
                            }}
                        >
                            <div className={`${prefixCls}-prefix`}>
                                {
                                    status === 'completed' ? completedIcon() : loadingIcon()
                                }
                            </div>
                            <div className={`${prefixCls}-summary`}>{summary}</div>
                            {
                                actionsLength > 0 && (
                                    <div className={`${prefixCls}-suffix`}>
                                        {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                                    </div>
                                )
                            }
                        </div>
                        <Collapsible isOpen={isOpen}>
                            <div className={`${prefixCls}-panel`}>
                                <div className={`${prefixCls}-line`} />
                                <div className={`${prefixCls}-action-wrapper`}>
                                    {actions?.map((action, i) => (
                                        <div 
                                            key={i}
                                            className={`${prefixCls}-action`}
                                        >
                                            <div className={`${prefixCls}-action-summary`}>{action.summary}</div>
                                            <div className={`${prefixCls}-action-desc`}>
                                                {action.icon}
                                                {action.description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Collapsible>
                    </React.Fragment>
                );
            })}
        </div>
    );
};