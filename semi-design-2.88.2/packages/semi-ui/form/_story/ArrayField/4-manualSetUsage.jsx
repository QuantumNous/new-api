import React, { useState, useRef } from 'react';
import { Form, Col, Row, Button, ArrayField, Space } from '@douyinfe/semi-ui';
import { IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';

function ManualSetDemo() {
    const formRef = useRef();
    const formInitValues = {
        data: [
            { name: 'Semi D2C', role: 'Engineer' },
            { name: 'Semi C2D', role: 'Designer' },
            // { name: 'Semi DSM', role: 'Designer' },
        ]
    };

    const setValue = () => {
        const formApi = formRef.current.formApi;
    };
    
    return (
        <Form ref={formRef} initValues={formInitValues}>
            <ArrayField field="data">
                {({ add, addWithInitValue, arrayFields }) => (
                    <React.Fragment>
                        <Space>
                            <Button id='add' onClick={add} icon={<IconPlusCircle />} type="primary">Add</Button>
                            <Button
                                id='addWithInit'
                                onClick={() => addWithInitValue({ name: `Semi New-${arrayFields.length + 1}`, role: 'Designer' })}
                                icon={<IconPlusCircle />}
                                type="primary">
                                Add with row initValue
                            </Button>
                        </Space>
                        {
                            arrayFields.map(({ field, key, remove }, i) => (
                                <div key={key} style={{ display: 'flex', width: 600 }} id={`data-${i}`} className='line'>
                                    <Space>
                                        <Form.Input
                                            id={`data-${i}-name`}
                                            field={`${field}[name]`}
                                            label={`${field}.name`}
                                            style={{ width: 200 }}
                                        />
                                        <Form.Input
                                            id={`data-${i}-role`}
                                            field={`${field}[role]`}
                                            label={`${field}.role`}
                                            style={{ width: 200 }}
                                        />
                                    </Space>
                                    <Button style={{ margin: "36px 0 0 12px" }} type="danger" icon={<IconMinusCircle/>} onClick={remove}>remove this line</Button>
                                </div>
                            ))
                        }
                        <Button htmlType='reset'>Reset</Button>
                    </React.Fragment>
                )}
            </ArrayField>
        </Form>
    );
}

ManualSetDemo.storyName = 'ArrayField-ManualSet';

export default ManualSetDemo;