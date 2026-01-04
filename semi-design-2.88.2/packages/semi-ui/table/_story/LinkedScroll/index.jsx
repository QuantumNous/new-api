import React from 'react';
import { Table } from '@douyinfe/semi-ui';

import './index.scss';

const ariticle = `Semi Design 是由抖音前端团队与 UED
团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
Web 应用。`;

const columns = [
    {
        title: 'Name',
        dataIndex: 'name',
        render: text => <a href="https://semi.design">{text}</a>,
    },
    {
        title: 'Age',
        dataIndex: 'age',
    },
    {
        title: 'Address',
        dataIndex: 'address',
    },
];

const dataSource = [
    {
        key: '1',
        name: 'John Brown',
        age: 32,
        address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
    },
    {
        key: '2',
        name: 'Jim Green',
        age: 42,
        address: 'London No. 1 Lake Park',
    },
    {
        key: '3',
        name: 'Joe Black',
        age: 32,
        address: 'Sidney No. 1 Lake Park',
    },
    {
        key: '4',
        name: 'Disabled User',
        age: 99,
        address: 'Sidney No. 1 Lake Park',
    },
];

const table = (
    <table>
        <thead>
            <tr>
                {columns.map((column, idx) => (
                    <td key={column.dataIndex || idx}>{column.title}</td>
                ))}
            </tr>
        </thead>
        <tbody>
            {dataSource.map((data, dataIndex) => (
                <tr key={data.key || dataIndex}>
                    {columns.map((column, columnIdx) => (
                        <td key={column.dataIndex || columnIdx}>{data[column.dataIndex]}</td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

export default class LinkedScroll extends React.Component {
    constructor(props) {
        super(props);

        this.leftRef = null;
        this.ref = null;
        this.rightRef = null;
    }

    handleBodyScrollTop = e => {
        const target = e.target;
        if (e.currentTarget !== target) {
            return;
        }
        const { leftRef, ref, rightRef } = this;
        if (target.scrollTop !== this.lastScrollTop) {
            const scrollTop = target.scrollTop;
            if (leftRef && target !== leftRef) {
                leftRef.scrollTop = scrollTop;
            }
            if (rightRef && target !== rightRef) {
                rightRef.scrollTop = scrollTop;
            }
            if (ref && target !== ref) {
                ref.scrollTop = scrollTop;
            }
        }
        // Remember last scrollTop for scroll direction detecting.
        this.lastScrollTop = target.scrollTop;
    };

    render() {
        const content = table;

        return (
            <div style={{ position: 'relative', display: 'flex', padding: 20 }}>
                <div
                    style={{ width: 200, height: 200, overflow: 'scroll' }}
                    ref={node => {this.leftRef = node;}}
                    onScroll={this.handleBodyScrollTop}
                >
                    <p>{content}</p>
                    <p>{content}</p>
                </div>
                <div
                    style={{ width: 200, height: 200, overflow: 'scroll' }}
                    ref={node => {this.ref = node;}}
                    onScroll={this.handleBodyScrollTop}
                >
                    <p>{content}</p>
                    <p>{content}</p>
                </div>
                <div
                    style={{ width: 200, height: 200, overflow: 'scroll' }}
                    ref={node => {this.rightRef = node;}}
                    onScroll={this.handleBodyScrollTop}
                >
                    <p>{content}</p>
                    <p>{content}</p>
                </div>
            </div>
        );
    }
}
