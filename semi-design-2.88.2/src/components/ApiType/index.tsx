import React from 'react';
import { Tooltip, Tag } from '@douyinfe/semi-ui';

const ApiType = (props) => {
    const ApiDetail = (detailProps) => {
        let detail = detailProps.detail;
        if (detailProps.detail.includes("\\")) {
            detail = detailProps.detail.replaceAll("\\", "");
        }
        return <div className='semi-api-table-interface-detial' style={{ wordBreak: 'break-word' }}>
            {detail}
        </div>;
    };

    return (
        <Tooltip
            content={<ApiDetail {...props}></ApiDetail>}
            style={{ maxWidth: 650 }}
        >
            <Tag
                color='yellow'
                style={{
                    color: 'var(--semi-color-warning)',
                    letterSpacing: '-0.02em',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace"
                }}
            >
                {props.children}
            </Tag>
        </Tooltip>
    );
};

export default ApiType;