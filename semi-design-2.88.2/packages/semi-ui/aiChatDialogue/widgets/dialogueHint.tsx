import React from "react";
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/aiChatDialogue/constants';
const { PREFIX_HINT } = cssClasses;

interface HintProps {
    className?: string;
    style?: React.CSSProperties;
    hints?: string[];
    selecting?: boolean;
    onHintClick?: (item: string) => void;
    renderHintBox?: (props: {content: string; index: number; onHintClick: () => void}) => React.ReactNode
}

const Hint = React.memo((props: HintProps) => {
    const { hints, onHintClick, renderHintBox, className, style, selecting } = props;

    return (
        <section 
            className={cls(`${PREFIX_HINT}s`, {
                [className]: !!className,
                [`${PREFIX_HINT}s-selecting`]: selecting,
            })}
            style={style}
        >
            {hints.map((item: string, index: number) => {
                if (renderHintBox) {
                    return renderHintBox({
                        content: item, 
                        index: index,
                        onHintClick: () => {
                            onHintClick?.(item);
                        }
                    });
                }
                return (
                    <div 
                        role="button"
                        tabIndex={0}
                        className={`${PREFIX_HINT}-item`}
                        key={index} 
                        onClick={() => {
                            onHintClick?.(item);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                onHintClick?.(item);
                            }
                        }}
                    >
                        <div className={`${PREFIX_HINT}-content`}>
                            {item}
                        </div>
                    </div>
                );
            })} 
        </section> 
    );
});

export default Hint;
