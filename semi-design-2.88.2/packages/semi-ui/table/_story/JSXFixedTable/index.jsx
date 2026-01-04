import { Table, Tooltip, Tag, Icon, Button } from '@douyinfe/semi-ui';
import React from 'react';

const { Column } = Table;

class TableApp extends React.Component {
    constructor() {
        super();
        this.columns = [
            {
                title: '任务名',
                dataIndex: 'TaskName',
                width: 200,
                fixed: true,
                filters: [
                    {
                        text: 'King 3',
                        value: 'King 3',
                    },
                    {
                        text: 'King 4',
                        value: 'King 4',
                    },
                ],
                onFilter: (value, record) => record.name.includes(value),
            },
            {
                title: '目标ID',
                dataIndex: 'TargetId',
                width: 100,
                sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
            },
            {
                title: '记录ID',
                width: 100,
                dataIndex: 'RecordId',
            },
            {
                title: '产品线',
                width: 120,
                dataIndex: 'AppId',
            },
            {
                title: '任务类型',
                width: 120,
                dataIndex: 'TaskType',
            },
            {
                title: '开始时间',
                width: 120,
                dataIndex: 'StartTime',
            },
            {
                title: '结束时间',
                width: 120,
                dataIndex: 'EndTime',
            },
            {
                title: '当前阶段',
                width: 120,
            },
            {
                title: '任务条件计数',
                // width: 400,
                dataIndex: 'CondStats',
            },
            {
                title: '任务状态',
                fixed: 'right',
                dataIndex: 'Status',
                width: 250,
                // render: (text, record) => (
                //     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                //         <Icon type={'edit'} />
                //     </div>
                // ),
                render: (text, record) => (
                    <span style={{ display: 'inline-block' }}>
                        <Icon type={'edit'} />
                    </span>
                ),
            },
        ];

        this.data = [];

        this.rowSelection = {
            onChange: (selectedRowKeys, selectedRows) => {
                // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
            },
            getCheckboxProps: record => ({
                disabled: record.name === 'Michael James', // Column configuration not to be checked
                name: record.name,
            }),
        };

        /*for (let i = 0; i < 46; i++) {
            let age = 40 + (Math.random() > 0.5 ? 1 : -1) * Math.ceil(i/3);
            let name = `Edward King ${i}`;
            this.data.push({
                key: '' + i,
                name,
                age,
                address: `London, Park Lane no. ${i}`,
                description: `My name is ${name}, I am ${age} years old, living in New York No. ${i+1} Lake Park.`,
            });
        }*/

        this.dataObj = {
            statusCode: 0,
            statusMessage: 'success',
            data: {
                total: 4,
                list: [
                    {
                        RecordId: '37',
                        TargetId: '3390524922266603',
                        TargetType: 3,
                        AppId: '1128',
                        TaskName: '第一周时长任务',
                        TaskId: '10158',
                        TaskType: 60,
                        StartTime: '1578672000',
                        EndTime: '1579276800',
                        CurrentStage: 2,
                        StageTimes: {},
                        Status: 1,
                        CondStats:
                            '{"TaskExtAnchorLiveDuration":90,"TaskExtAnchorLiveDuration_max":120,"TaskExtAnchorValidDay":0,"TaskExtAnchorValidDay_max":1}',
                        CreateTime: '1576756961',
                    },
                    {
                        RecordId: '39',
                        TargetId: '3390524922266603',
                        TargetType: 3,
                        AppId: '1128',
                        TaskName: '第一周收益任务',
                        TaskId: '10159',
                        TaskType: 60,
                        StartTime: '1578672000',
                        EndTime: '1579276800',
                        CurrentStage: 2,
                        StageTimes: {},
                        Status: 1,
                        CondStats:
                            '{"TaskExtAnchorFanTicket":200,"TaskExtAnchorFanTicket_max":2600,"TaskExtAnchorLiveDuration":90,"TaskExtAnchorLiveDuration_max":120,"TaskExtAnchorValidDay":0,"TaskExtAnchorValidDay_max":1}',
                        CreateTime: '1576757053',
                    },
                    {
                        RecordId: '40',
                        TargetId: '3390524922266603',
                        TargetType: 3,
                        AppId: '1128',
                        TaskName: '第二周时长任务',
                        TaskId: '10161',
                        TaskType: 60,
                        StartTime: '1578672000',
                        EndTime: '1579276800',
                        CurrentStage: 2,
                        StageTimes: {},
                        Status: 1,
                        CondStats:
                            '{"TaskExtAnchorLiveDuration":90,"TaskExtAnchorLiveDuration_max":120,"TaskExtAnchorValidDay":0,"TaskExtAnchorValidDay_max":1}',
                        CreateTime: '1576757103',
                    },
                    {
                        RecordId: '41',
                        TargetId: '3390524922266603',
                        TargetType: 3,
                        AppId: '1128',
                        TaskName: '第二周收益任务',
                        TaskId: '10162',
                        TaskType: 60,
                        StartTime: '1578672000',
                        EndTime: '1579276800',
                        CurrentStage: 2,
                        StageTimes: {},
                        Status: 1,
                        CondStats:
                            '{"TaskExtAnchorFanTicket":200,"TaskExtAnchorFanTicket_max":2600,"TaskExtAnchorLiveDuration":90,"TaskExtAnchorLiveDuration_max":120,"TaskExtAnchorValidDay":0,"TaskExtAnchorValidDay_max":1}',
                        CreateTime: '1576757109',
                    },
                ],
            },
        };

        this.scroll = { /*y: 300,*/ x: `160%` };
    }

    render() {
        return (
            <>
                <Table columns={this.columns} dataSource={this.dataObj.data.list} scroll={this.scroll}>
                    {/* <Column title="任务名" dataIndex="TaskName" fixed width={200} />
                <Column title="目标ID" width={100} dataIndex="TargetId" />
                <Column title="记录ID" width={100} dataIndex="RecordId" />
                <Column title="产品线" width={120} dataIndex="AppId" />
                <Column title="任务类型" width={120} dataIndex="TaskType" />
                <Column width={360} title="开始时间" dataIndex="StartTime" />
                <Column width={120} title="结束时间" dataIndex="EndTime" />
                <Column width={120} title="下发时间" dataIndex="CreateTime" />
                <Column width={120} title="当前阶段" />
                <Column title="任务条件计数" dataIndex="CondStats" />
                <Column fixed="right" width={120} title="任务状态" dataIndex="Status" /> */}
                </Table>
                <Table dataSource={this.dataObj.data.list} scroll={this.scroll}>
                    <Column title="任务名" dataIndex="TaskName" fixed width={200} />
                    <Column title="目标ID" width={100} dataIndex="TargetId" />
                    <Column title="记录ID" width={100} dataIndex="RecordId" />
                    <Column title="产品线" width={120} dataIndex="AppId" />
                    <Column title="任务类型" width={120} dataIndex="TaskType" />
                    <Column width={120} title="开始时间" dataIndex="StartTime" />
                    <Column width={120} title="结束时间" dataIndex="EndTime" />
                    <Column width={120} title="下发时间" dataIndex="CreateTime" />
                    <Column width={120} title="当前阶段" />
                    <Column title="任务条件计数" dataIndex="CondStats" />
                    <Column fixed="right" width={120} title="任务状态" dataIndex="Status" />
                </Table>
            </>
        );
    }
}

export default TableApp;
