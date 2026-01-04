import { ArrayField, TextArea, Form, Button, useFormState } from '@douyinfe/semi-ui';
import React, { useRef, useState } from 'react';

const Demo = () => {
    const formRef = useRef();
    const [flag, setFlag] = useState(false);
    return (
        <Form ref={formRef} onValueChange={values => console.log(values)} style={{ width: 250 }}>
            <Button type="primary" onClick={() => setFlag(!flag)} className="btn-margin-right">
                {!flag ? '开启' : '关闭'}
            </Button>

            {flag && (
                <ArrayField field="rules">
                    {({ add, arrayFields, addWithInitValue }) => (
                        <React.Fragment>
                            <Button onClick={add} theme="light">
                                Add new line
                            </Button>
                            <Button
                                onClick={() => {
                                    addWithInitValue({ name: 'Semi DSM', type: 'Designer' });
                                }}
                                style={{ marginLeft: 8 }}
                            >
                                Add new line with init value
                            </Button>
                            {arrayFields.map(({ field, key, remove }, i) => (
                                <div key={key} style={{ width: 1000, display: 'flex' }}>
                                    <Form.Input
                                        field={`${field}[name]`}
                                        label={`${field}.name`}
                                        style={{ width: 200, marginRight: 16 }}
                                    />
                                    <Form.Select
                                        field={`${field}[role]`}
                                        label={`${field}.role`}
                                        style={{ width: 120 }}
                                        optionList={[
                                            { label: 'Engineer', value: 'Engineer' },
                                            { label: 'Designer', value: 'Designer' },
                                        ]}
                                    />
                                    <Button type="danger" theme="borderless" onClick={remove} style={{ margin: 12 }} />
                                </div>
                            ))}
                        </React.Fragment>
                    )}
                </ArrayField>
            )}
        </Form>
    );
};


export default Demo;