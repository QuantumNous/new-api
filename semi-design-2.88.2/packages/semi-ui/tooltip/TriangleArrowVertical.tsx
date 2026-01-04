import React from 'react';

const TriangleArrowVertical: React.FC<{ [key: string]: any }> = props => {
    const { className, style, ...restProps } = props;
    return (
        <svg aria-hidden className={className} style={style} {...restProps} width="7" height="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M0 0L1 0C1 4, 2 5.5, 4 7.5S7,10 7,12S6 14.5, 4 16.5S1,20 1,24L0 24L0 0z" />
        </svg>
    );
};

export default TriangleArrowVertical;