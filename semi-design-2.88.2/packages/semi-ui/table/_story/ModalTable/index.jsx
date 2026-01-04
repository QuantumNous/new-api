import React, { useState, useMemo } from 'react';
import { Modal, Button, Table } from '@douyinfe/semi-ui';

const types = ['Array', 'String', 'Number', 'Object'];

function ModalTable() {
    const dataTotalSize = 46;

    const [modalShow, setModalShow] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    const columns = [
        {
            title: '名称',
            key: 'name',
            width: 150,
            // render: (text, record) => <span style={{ wordWrap: 'break-word', wordBreak: 'break-word' }}>{text}</span>,
            dataIndex: 'name',
            fixed: 'left',
        },
        {
            title: 'id',
            key: 'id',
            width: 150,
            // render: (text, record) => <span style={{ wordWrap: 'break-word', wordBreak: 'break-word' }}>{text}</span>,
            dataIndex: 'id',
        },
        {
            title: '描述',
            key: 'description',
            // width: 150,
            dataIndex: 'description',
        },
        {
            title: '类型',
            key: 'type',
            width: 150,
            dataIndex: 'type',
            fixed: 'right',
        },
    ];
    // const data = [];
    // for (let i = 0; i < dataTotalSize; i++) {
    //     let age = (i * 1000) % 149 ;
    //     let name = `Edward King ${i}`;
    //     data.push({
    //         key: '' + new Date().toString(16),
    //         name,
    //         age,
    //         type: types[i % types.length],
    //         address: `London, Park Lane no. ${i} Lake Park`,
    //         description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
    //     });
    // }

    const data = [
        {
            Chinese_description: '认证类型',
            Chinese_name: '认证类型',
            _tags: null,
            default: '-1',
            description: '认证类型',
            id: 594,
            name: 'cert_type',
            noaction: 0,
            operation: 0,
            property_id: 523,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'Integer',
        },
        {
            Chinese_description: '粉丝数',
            Chinese_name: '粉丝数',
            _tags: null,
            default: '0',
            description: '粉丝数',
            id: 595,
            name: 'fans_count',
            noaction: 0,
            operation: 1,
            property_id: 524,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'Integer',
        },
        {
            Chinese_description: '用户标签',
            Chinese_name: '用户标签',
            _tags: null,
            default: '[]',
            description: '用户标签',
            id: 596,
            items: {
                Chinese_description: '用户标签',
                Chinese_name: '用户标签',
                _tags: null,
                default: null,
                description: '用户标签',
                id: 597,
                noaction: 0,
                operation: 0,
                property_id: 0,
                ref_entity_id: 0,
                ref_property_id: 0,
                ref_type: 0,
                type: 'Integer',
            },
            name: 'hot_user_label',
            noaction: 0,
            operation: 1,
            property_id: 525,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'Array',
        },
        {
            Chinese_description: '用户库标签',
            Chinese_name: ' 用户库标签',
            _tags: null,
            default: '0',
            description: '用户库标签',
            id: 598,
            name: 'hot_user_level',
            noaction: 0,
            operation: 1,
            property_id: 526,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'Integer',
        },
        {
            Chinese_description: '特效师',
            Chinese_name: '特效师',
            _tags: null,
            default: null,
            description: '特效师',
            id: 599,
            name: 'is_sticker_designer',
            noaction: 0,
            operation: 1,
            property_id: 527,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'Boolean',
        },
        {
            Chinese_description: '机构认证细分',
            Chinese_name: '机构认证细分',
            _tags: null,
            default: '-1',
            description: '机构认证细分',
            id: 600,
            name: 'org_type',
            noaction: 0,
            operation: 1,
            property_id: 528,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'Integer',
        },
        {
            Chinese_description: '用户名',
            Chinese_name: '用户名',
            _tags: null,
            default: null,
            description: '用户名',
            id: 602,
            name: 'user_name',
            noaction: 0,
            operation: 1,
            property_id: 529,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'String',
        },
        {
            Chinese_description: '用户注册省份',
            Chinese_name: '用户注册省份',
            _tags: null,
            default: '',
            description: '用户注册省份',
            id: 603,
            name: 'user_register_province',
            noaction: 0,
            operation: 1,
            property_id: 530,
            ref_entity_id: 0,
            ref_property_id: 0,
            ref_type: 0,
            type: 'String',
        },
    ];

    const rowSelection = useMemo(
        () => ({
            selectedRowKeys,
            onChange: (selectedRowKeys, selectedRows) => {
                // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
                setSelectedRowKeys([...selectedRowKeys]);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Disabled User', // Column configuration not to be checked
                name: record.name,
            }),
        }),
        [selectedRowKeys]
    );

    return (
        <div>
            <Button onClick={() => setModalShow(true)}>显示浮层</Button>
            <Modal visible={modalShow} onCancel={() => setModalShow(false)} width={800}>
                <Table dataSource={data} columns={columns} scroll={{ y: 240, x: 1000 }} rowKey={'name'} />
            </Modal>
            <Table dataSource={data} columns={columns} scroll={{ y: 480 }} rowKey={'name'} />
        </div>
    );
}

export default ModalTable;
