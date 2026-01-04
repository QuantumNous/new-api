import React, { ReactNode, useCallback } from 'react';
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatInput/constants';
import { RenderSkillItemProps, Skill } from './interface';

const prefixCls = cssClasses.PREFIX;

interface SkillItemProps {
    skill?: Skill;
    renderSkillItem?: (props: RenderSkillItemProps) => ReactNode;
    isActive?: boolean;
    onClick?: (skill: Skill) => void;
    index?: number;
    onMouseEnter?: (index: number) => void
}

const SkillItem = React.memo((props: SkillItemProps) => {
    const { skill, onClick, isActive, renderSkillItem, onMouseEnter, index } = props;
    const className = cls(`${prefixCls}-skill-item`, {
        [`${prefixCls}-skill-item-active`]: isActive
    });
    const handleClick = useCallback(() => {
        onClick(skill);
    }, [onClick, skill]);

    const handleMouseEnter = useCallback(() => {
        onMouseEnter?.(index);
    }, [index, onMouseEnter]);

    if (renderSkillItem) {
        return <>{renderSkillItem({
            skill: skill,
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
        {skill.icon}
        <div className={`${prefixCls}-skill-item-content`}>
            {skill.label}
        </div>
    </div>);
});

export default SkillItem;
