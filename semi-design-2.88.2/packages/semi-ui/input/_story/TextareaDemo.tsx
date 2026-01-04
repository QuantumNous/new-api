import React from 'react';
import Textarea from '../textarea';

const TextareaDemo = (): React.ReactElement => (
    <div>
        <Textarea
            placeholder="textarea"
            onEnterPress={(): void => {
                alert('enter');
            }}
            style={{ width: 300 }}
            disabled
        />
        <Textarea
            style={{ width: 300 }}
            placeholder="textarea"
            onEnterPress={(): void => {
                alert('enter');
            }}
            onChange={(): void => {
                console.log('ipt');
            }}
        />
    </div>
);

export default TextareaDemo;
