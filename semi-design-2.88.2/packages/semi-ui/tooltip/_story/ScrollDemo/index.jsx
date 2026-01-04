import React from 'react';
import { Tooltip, Button } from '@douyinfe/semi-ui';

function Demo() {
    const containerId = 'container';
    const scrollItemId = `scroll-item`;
    const scrollContainerId = `scroll-container`;
    const triggerId = `trigger`;

    return (
        <div style={{ height: 2000 }}>
            <div
                style={{
                    height: 320,
                    width: 320,
                    display: 'inline-block',
                    overflow: 'auto',
                    padding: 50,
                    marginTop: 100,
                }}
                id={scrollContainerId}
            >
                <div style={{ height: 480, width: 320 }} id={scrollItemId}>
                    <div id={containerId}></div>
                    <Tooltip
                        motion={true}
                        showArrow={true}
                        content={'Content'}
                        visible={true}
                        trigger={'click'}
                        getPopupContainer={() => document.getElementById(containerId)}
                    >
                        <Button id={triggerId}>Click here</Button>
                    </Tooltip>
                    <Tooltip
                        disabled
                        motion={true}
                        showArrow={true}
                        content={'Content'}
                        visible={true}
                        trigger={'click'}
                        getPopupContainer={() => document.getElementById(containerId)}
                    >
                        <Button disabled block>
                            Click here
                        </Button>
                    </Tooltip>
                    <Tooltip
                        motion={true}
                        showArrow={true}
                        content={'Content'}
                        visible={true}
                        trigger={'click'}
                        getPopupContainer={() => document.getElementById(containerId)}
                        wrapWhenSpecial={false}
                    >
                        <Button>Click here</Button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

export default Demo;
