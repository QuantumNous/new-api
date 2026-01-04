import React, { useState, useRef } from 'react';
import PinCode from '../index';

export default {
    title: 'PinCode',
};

export const PinCodeBasic = () => (
    <>
        <PinCode
            size={'small'}
            onComplete={v => alert(v)}
            onChange={v => {
                console.log(v);
            }}
        />
        <PinCode
            size={'default'}
            onComplete={v => alert(v)}
            onChange={v => {
                console.log(v);
            }}
        />
        <PinCode
            size={'large'}
            onComplete={v => alert(v)}
            onChange={v => {
                console.log(v);
            }}
        />
    </>
);

export const PinCodeControl = () => {
    const [value, setValue] = useState('123');
    const ref = useRef();
    return (
        <>
            <button onClick={() => ref.current.focus(2)}>focus third</button>
            <PinCode
                format={'mixed'}
                ref={ref}
                onComplete={value => console.log('pincode: ', value)}
                value={value}
                onChange={v => {
                    console.log(v);
                    setValue(v);
                }}
            />
        </>
    );
};
