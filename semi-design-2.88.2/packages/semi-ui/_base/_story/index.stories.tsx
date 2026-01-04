import React, { useMemo } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, InputNumber, Form, Dropdown, Tag } from '../../index';

const stories = storiesOf('All', module);

stories.add('simple', () => {
    function Demo() {
        const subDropdown = useMemo(
            () => (
                <Dropdown.Menu>
                    <Dropdown.Item>Menu Item 1</Dropdown.Item>
                    <Dropdown.Item>Menu Item 2</Dropdown.Item>
                    <Dropdown.Item>Menu Item 3</Dropdown.Item>
                </Dropdown.Menu>
            ),
            []
        );
        return (
            <>
                <div style={{ width: 500 }}>
                    <Button icon={'edit'} theme={'solid'} />
                    <InputNumber max={100} min={10} defaultValue={5} />
                    <Form layout="horizontal">
                        <Form.Select field="Role" label="角色" style={{ width: 120 }}>
                            <Form.Select.Option value="admin">管理员</Form.Select.Option>
                            <Form.Select.Option value="user">普通用户</Form.Select.Option>
                            <Form.Select.Option value="guest">访客</Form.Select.Option>
                        </Form.Select>
                        <Form.Input field="UserName" label="用户名" />
                        <Form.Input field="Password" label="密码" />
                        <Form.DatePicker type={'dateRange'} field={'dateRange'} label={'date range'} />
                    </Form>
                    <Dropdown
                        render={
                            <Dropdown.Menu>
                                <Dropdown position={'rightTop'} render={subDropdown}>
                                    <Dropdown.Item>Menu Item 1</Dropdown.Item>
                                </Dropdown>
                                <Dropdown position={'leftTop'} render={subDropdown}>
                                    <Dropdown.Item>Menu Item 2</Dropdown.Item>
                                </Dropdown>
                                <Dropdown.Item>Menu Item 3</Dropdown.Item>
                            </Dropdown.Menu>
                        }
                    >
                        <Tag>Hover Me</Tag>
                    </Dropdown>
                </div>
            </>
        );
    }

    return <Demo />;
});
