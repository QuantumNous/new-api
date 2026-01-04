import React from 'react';
import { Tag, Popover } from '../../../index';

function Item(props = {}) {
    const tops = [
        ['topLeft', 'TL'],
        ['top', 'Top'],
        ['topRight', 'TR'],
    ];
    const lefts = [
        ['leftTop', 'LT'],
        ['left', 'Left'],
        ['leftBottom', 'LB'],
    ];
    const rights = [
        ['rightTop', 'RT'],
        ['right', 'Right'],
        ['rightBottom', 'RB'],
    ];
    const bottoms = [
        ['bottomLeft', 'BL'],
        ['bottom', 'Bottom'],
        ['bottomRight', 'BR'],
    ];

    const { tagStyle, ...restProps } = props;

    return (
        <div style={{ paddingLeft: 40 }}>
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Popover
                        content={(
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        )
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                        trigger={'click'}
                        arrowPointAtCenter={true}
                        {...restProps}
                    >
                        <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Popover
                        content={(
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        )}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                        trigger={'click'}
                        arrowPointAtCenter={true}
                        {...restProps}
                    >
                        <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Popover
                        content={(
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        )}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                        trigger={'click'}
                        arrowPointAtCenter={true}
                        {...restProps}
                    >
                        <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Popover
                        content={(
                            <article>
                                <p>hi bytedance</p>
                                <p>hi bytedance</p>
                            </article>
                        )}
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                        trigger={'click'}
                        arrowPointAtCenter={true}
                        {...restProps}
                    >
                        <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Popover>
                ))}
            </div>
        </div>
    );
}

function Demo() {
    return (
        <div>
            <div style={{ padding: 120 }}>
                <Item showArrow />
            </div>
            <div style={{ padding: 120 }}>
                <Item showArrow tagStyle={{ minHeight: 80, minWidth: 120 }} />
            </div>
            <div style={{ padding: 120 }}>
                <Item showArrow tagStyle={{ minHeight: 80, minWidth: 120 }} style={{ backgroundColor: 'green' }} />
            </div>
            <div style={{ padding: 120 }}>
                <Item
                    showArrow
                    tagStyle={{ minHeight: 80, minWidth: 120 }}
                    style={{ backgroundColor: 'pink' }}
                    content={null}
                />
            </div>
            <div style={{ padding: 120 }}>
                <Item showArrow content={null} style={{ backgroundColor: 'orange' }} />
            </div>
        </div>
    );
}

export default Demo;
