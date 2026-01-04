import React, { useEffect } from 'react';
import { Form } from '@douyinfe/semi-ui';
const { RadioGroup, Radio } = Form;

export default function MyRadio(props) {
    const { formRef, setValue } = props;

    useEffect(() => {
        console.log('didMount inner');
    }, []);

    return (
        <RadioGroup mode="advanced" field="radio" label="是否独占资源（Radio）" initValue={false}>
            <div style={{ display: 'flex' }}>
                <div
                    style={{ width: 100, height: 100, border: '1px solid red' }} onClick={() => {
                        formRef.current.formApi.setValue('radio', true);
                        setValue(true);
                    }}>
                    <Radio value={true}>是</Radio>
                </div>
                <div
                    style={{ width: 100, height: 100, border: '1px solid red' }} onClick={() => {
                        formRef.current.formApi.setValue('radio', false);
                        setValue(false);
                    }}>
                    <Radio value={false}>否</Radio>
                </div>
            </div>
        </RadioGroup>
    );
}