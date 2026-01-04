import { Descriptions, Tag } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import React from "react";

const data = [
    { key: '实际用户数量', value: '1,480,000' },
    { key: '7天留存', value: '98%' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: <Tag>电商</Tag> },
    { key: '认证状态', value: '未认证' },
];

const dataWithHide = [
    { key: '实际用户数量', value: '1,480,000', hidden: true },
    { key: '7天留存', value: '98%' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: <Tag style={{ margin: 0 }}>电商</Tag> },
    { key: '认证状态', value: '未认证' },
];

const dataWithKeyIsNode = [
    { key: <strong>实际用户数量</strong>, value: '1,480,000' },
    { key: '7天留存', value: '98%' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: <Tag>电商</Tag> },
    { key: '认证状态', value: '未认证' },
];

function renderDescriptions(props) {
    const realProps = {
        data,
        ...props,
    };
    return mount(<Descriptions {...realProps}></Descriptions>, {
        attachTo: document.getElementById('container'),
    });
}

describe('Descriptions', () => {

    beforeEach(() => {
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
        document.body.innerHTML = '';
    });

    it('Descriptions with data', () => {
        const descriptions = renderDescriptions();
        const item = document.querySelectorAll('tr');
        expect(item.length).toEqual(5);
        expect(
            descriptions
                .find(`.${BASE_CLASS_PREFIX}-descriptions-key`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('实际用户数量');
        expect(
            descriptions
                .find(`.${BASE_CLASS_PREFIX}-descriptions-value`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('1,480,000');
        descriptions.unmount();
    });

    it('Descriptions with className / style', () => {
        const props = {
            className: 'test',
            style: { height: 420 },
        };
        const descriptions = renderDescriptions(props);
        expect(descriptions.hasClass('test')).toEqual(true);
        expect(descriptions.find('div.test')).toHaveStyle('height', 420);
        descriptions.unmount();
    });

    it('Descriptions with align', () => {
        const centerDesc = renderDescriptions({ align: "center" });
        expect(centerDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-center`)).toEqual(true);
        centerDesc.unmount();

        const justifyDesc = renderDescriptions({ align: "justify" });
        expect(justifyDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-justify`)).toEqual(true);
        justifyDesc.unmount();

        const leftDesc = renderDescriptions({ align: "left" });
        expect(leftDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-left`)).toEqual(true);
        leftDesc.unmount();

        const plainDesc = renderDescriptions({ align: "plain" });
        expect(plainDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-plain`)).toEqual(true);
        plainDesc.unmount();
    });

    it('Descriptions with row', () => {
        const rowDesc = renderDescriptions({ row: true });
        expect(rowDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-double`)).toEqual(true);
        rowDesc.unmount();
    });

    it('Descriptions with dataItem hidden', () => {
        const rowDesc = renderDescriptions({ data: dataWithHide });
        const item = document.querySelectorAll('tr');
        expect(item.length).toEqual(4);
        expect(
            rowDesc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-key`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('7天留存');
        expect(
            rowDesc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-value`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('98%');
        rowDesc.unmount();
    });

    it('Descriptions with size', () => {
        const smallDesc = renderDescriptions({ row: true, size: 'small' });
        expect(smallDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-double-small`)).toEqual(true);
        smallDesc.unmount();

        const mediumDesc = renderDescriptions({ row: true, size: 'medium' });
        expect(mediumDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-double-medium`)).toEqual(true);
        mediumDesc.unmount();

        const largeDesc = renderDescriptions({ row: true, size: 'large' });
        expect(largeDesc.exists(`.${BASE_CLASS_PREFIX}-descriptions-double-large`)).toEqual(true);
        largeDesc.unmount();
    });

    it('Descriptions with jsx', () => {
        const desc = mount(
            <Descriptions>
                <Descriptions.Item itemKey="实际用户数量">1,480,000</Descriptions.Item>
                <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
                <Descriptions.Item itemKey="安全等级">3级</Descriptions.Item>
                <Descriptions.Item itemKey="垂类标签">电商</Descriptions.Item>
                <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
            </Descriptions>, {
            attachTo: document.getElementById('container'),
        });
        const item = document.querySelectorAll('tr');
        expect(item.length).toEqual(5);
        expect(
            desc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-key`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('实际用户数量');
        expect(
            desc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-value`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('1,480,000');
        desc.unmount();
    });

    it('Descriptions with key is node', () => {
        const desc = renderDescriptions({ data: dataWithKeyIsNode });
        expect(
            desc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-key strong`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('实际用户数量');
        expect(
            desc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-key`)
                .at(1)
                .getDOMNode()
                .textContent
        ).toEqual('7天留存');
        desc.unmount();
    });

    it('Descriptions layout horizontal', () => {
        const desc = mount(
            <Descriptions layout='horizontal' align='left' column={4}>
                <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
                <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
                <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
            </Descriptions>, {
                attachTo: document.getElementById('container'),
            });
        const tds = document.querySelectorAll('td');
        expect(tds.length).toEqual(3);
        const ths = document.querySelectorAll('td');
        expect(ths.length).toEqual(3);
        const trs = document.querySelectorAll('tr');
        expect(trs.length).toEqual(1);
        expect(desc.exists(`.${BASE_CLASS_PREFIX}-descriptions-horizontal`)).toEqual(true);
        expect(
            desc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-key`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('实际用户数量');
        expect(
            desc
                .find(`.${BASE_CLASS_PREFIX}-descriptions-value`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('1,480,000');

        let totalSpan = ths.length
        tds.forEach(item=>{
            totalSpan += +item.getAttribute('colspan')
        })
        expect(totalSpan).toEqual(8);
        desc.unmount();
    });
})
