import React from 'react';
import { Tooltip, Button } from '../../../index';

export default function Demo() {
    const containerId = 'scroll-container';
    return (
        <div>
            <div
                style={{
                    width: 600,
                    height: 600,
                    backgroundColor: '#eee',
                    overflow: 'auto',
                }}
            >
                <div
                    style={{
                        width: 1200,
                        height: 1200,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    id={containerId}
                >
                    <Tooltip
                        content={'1111111'}
                        trigger={'click'}
                        position={'topLeft'}
                        getPopupContainer={() => document.getElementById(containerId)}
                    >
                        <Button icon={'edit'}>编辑</Button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}
