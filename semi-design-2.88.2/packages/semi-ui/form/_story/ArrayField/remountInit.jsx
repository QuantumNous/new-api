import React, { useState } from 'react';
import { ArrayField, TextArea, Form, Button, useFormState } from '@douyinfe/semi-ui';
import { IconPlusCircle, IconMinusCircle } from '@douyinfe/semi-icons';

// toggle form input visible 
// visible -> invisible -> visible
// initValue will not use in final round now
// The behavior in ArrayField is inconsistent with that in non-ArrayField, which is undefined behavior. Clearer guidance is needed.

const RemountInit = () => {
    const [data, setData] = useState([
        { name: 'arrayfield defualtValue' },
    ]);
    const [visible, setVisible] = useState(true);
    const ComponentUsingFormState = () => {
        const formState = useFormState();
        return (
            <TextArea style={{ marginTop: 10 }} value={JSON.stringify(formState)} />
        );
    };
    return (
        <Form style={{ width: 800 }} labelPosition='left' labelWidth='100px' allowEmpty>
            <Button onClick={() => { setVisible(!visible); }}>toggle</Button>
            <ArrayField field='rules' initValue={data}>
                {({ add, arrayFields }) => (
                    <React.Fragment> 
                        <Button onClick={add} icon={<IconPlusCircle />} theme='light'>Add new line</Button>
                        {
                            arrayFields.map(({ field, key, remove }, i) => (
                                <div key={key} style={{ width: 1000, display: 'flex' }}>
                                    {visible && <Form.Input
                                        field={`${field}[name]`}
                                        label={`${field}.name`}
                                        style={{ width: 200, marginRight: 16 }}
                                        initValue={'field init value'}
                                    >
                                    </Form.Input>}
                                    <Button
                                        type='danger'
                                        theme='borderless'
                                        icon={<IconMinusCircle />}
                                        onClick={remove}
                                        style={{ margin: 12 }}
                                    />
                                </div>
                            ))
                        }
                    </React.Fragment>
                )}
            </ArrayField>
            <ComponentUsingFormState />
        </Form>
    );
};
export default RemountInit;