import React from 'react';
import Radio from '../index';
import RadioGroup from '../radioGroup';

const Demo = (): React.ReactElement => (
    <div>
        <Radio extra="checked" checked>Radio</Radio>
        <Radio extra="advanced" mode="advanced">Radio</Radio>
        <hr />
        <RadioGroup
            onChange={(e: { target: { value: number } }): void => {
                console.log(e.target && e.target.value);
            }}
            buttonSize="small"
        >
            <Radio value={1}>A</Radio>
            <Radio value={2}>B</Radio>
            <Radio value={3}>C</Radio>
            <Radio value={4}>D</Radio>
        </RadioGroup>
        <RadioGroup
            onChange={(e: { target: { value: number } }): void => {
                console.log(e.target && e.target.value);
            }}
            buttonSize="large"
        >
            <Radio value={1}>X</Radio>
            <Radio value={2}>Y</Radio>
            <Radio value={3}>X</Radio>
        </RadioGroup>
    </div>
);

export default Demo;