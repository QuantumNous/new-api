import React, { useState } from 'react';
import { Select } from '@douyinfe/semi-ui';
import { types as styledTypes, loops, speeds, delays } from '../../index';

const types = Object.values(styledTypes).reduce((arr, cur) => [...arr, ...cur], []);

function All({ ...rest }) {
    const [type, setType] = useState('bounce');
    const [speed, setSpeed] = useState('slow');
    const [delay, setDelay] = useState('0s');
    const [loop, setLoop] = useState('1');

    const animStyle = {
        backgroundColor: 'rgb(241, 101, 101)',
        padding: '20px',
        // width: '200px',
        // height: '100px',
        margin: '20px',
        marginLeft: '50px',
        borderRadius: '4px',
        fontSize: '20px',
        color: 'white',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const cls = `semi-animated semi-${type} semi-speed-${speed} semi-delay-${delay} semi-loop-${loop}`;

    return (
        <div style={{}}>
            <div>
                <div className={cls} style={animStyle}>
                    {type}
                </div>
            </div>
            <div>
                <Select value={type} onChange={setType}>
                    {types.map(itType => (
                        <Select.Option key={itType} value={itType}>
                            {itType}
                        </Select.Option>
                    ))}
                </Select>
            </div>
        </div>
    );
}

export default All;
