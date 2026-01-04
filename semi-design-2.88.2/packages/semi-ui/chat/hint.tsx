import React from "react";
import { IconArrowRight } from "@douyinfe/semi-icons";
import cls from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/chat/constants';
const { PREFIX_HINT } = cssClasses;

interface HintProps {
    className?: string;
    style?: React.CSSProperties;
    value?: string[];
    onHintClick?: (item: string) => void;
    renderHintBox?: (props: {content: string; index: number; onHintClick: () => void}) => React.ReactNode
}

const Hint = React.memo((props: HintProps) => {
    const { value, onHintClick, renderHintBox, className, style } = props;
    return (
        <section 
            className={cls(`${PREFIX_HINT}s`, {
                [className]: !!className,
            })}
            style={style}
        >
            {value.map((item, index) => {
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
                        className={`${PREFIX_HINT}-item`}
                        key={index} 
                        onClick={() => {
                            onHintClick?.(item);
                        }}
                    >
                        <div className={`${PREFIX_HINT}-content`}>
                            {item}
                        </div>
                        <IconArrowRight className={`${PREFIX_HINT}-icon`}/>
                    </div>
                );
            })} 
        </section> 
    );
});

export default Hint;
