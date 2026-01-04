import React, { useState, useRef } from 'react';
import { Form, Col, Row, Button, ArrayField, Space } from '@douyinfe/semi-ui';
import { IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';
import { FixedSizeList as List } from "react-window";

// TODO ArrayField virtualize need to provider keepState first
const array = new Array(1500);

for (let i = 0; i < array.length; i++) {
    array[i] = {
        name: "Name" + i,
        role: "Role" + i
    };
}

const rowWidth = 1000;
const rowHeight = 50;

const renderRow = (row, index, style) => {
    const { field, key, remove } = row;
    return (
        <div
            key={key}
            style={{
                display: 'flex',
                alignItems: 'center',
                width: rowWidth,
                height: rowHeight,
                boxSizing: 'border-box',
                borderBottom: '1px solid var(--semi-color-border)',
                ...style // make sure to pass style
            }} 
            className='line'
        >
            <Space>
                <Form.Input
                    // id={`data-${index}-name`}
                    field={`${field}[name]`}
                    label={`${field}.name`}
                    style={{ width: 200 }}
                />
                <Form.Input
                    // id={`data-${index}-role`}
                    field={`${field}[role]`}
                    label={`${field}.role`}
                    style={{ width: 200 }}
                />
            </Space>
            <Button style={{ margin: "0 0 0 12px" }} type="danger" icon={<IconMinusCircle/>} onClick={remove}>remove this line</Button>
        </div>
    );
};

const VirtualRow = ({ index, data, style }) => {
    const { rowList, renderRow } = data;
    const row = rowList[index];
    return renderRow(row, index, style);
};

const RenderVirtualizeList = (props) => {
    return (
        <List
            height={props.height}
            itemCount={props.list.length}
            itemSize={rowHeight}
            itemData={{ rowList: props.list, renderRow: renderRow }}
            width={rowWidth}
        >
            {VirtualRow}
        </List>
    );
};

function ManyRowInArrayField() {
    const formRef = useRef();
    const formInitValues = {
        data: array
    };

    return (
        <Form
            labelPosition="left"
            labelWidth="100px"
            ref={formRef}
            initValues={formInitValues}
        >
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
                        <RenderVirtualizeList list={arrayFields} height={800}>

                        </RenderVirtualizeList>

                        {/* {
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
                        } */}
                        <Button htmlType='reset'>Reset</Button>
                    </React.Fragment>
                )}
            </ArrayField>
        </Form>
    );
}

ManyRowInArrayField.storyName = 'ArrayField-ManyRow';

export default ManyRowInArrayField;