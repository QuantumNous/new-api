import { List, Avatar, Button, ButtonGroup } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const dataSource = [
    '从明天起，做一个幸福的人',
    '喂马，劈柴，周游世界',
    '从明天起，关心粮食和蔬菜',
    '我有一所房子，面朝大海，春暖花开',
];

function renderList(props) {
    const realProps = {
        dataSource,
        renderItem: item => <List.Item>{item}</List.Item>,
        ...props,
    };
    return mount(<List {...realProps} />, {
        attachTo: document.getElementById('container'),
    });
}

describe('List', () => {

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

    it('List with jsx', () => {
        const list = mount(<List>
            <List.Item>从明天起，做一个幸福的人</List.Item>
            <List.Item>喂马，劈柴，周游世界</List.Item>
            <List.Item>从明天起，关心粮食和蔬菜</List.Item>
            <List.Item>我有一所房子，面朝大海，春暖花开菜</List.Item>
        </List>, {
            attachTo: document.getElementById('container'),
        });;
        const item = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-list-item`);
        expect(item.length).toEqual(4);
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-item`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('从明天起，做一个幸福的人');
        list.unmount();
    });

    it('List with basic renderItem', () => {
        const list = renderList();
        const item = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-list-item`);
        expect(item.length).toEqual(4);
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-item`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('从明天起，做一个幸福的人');
        list.unmount();
    });

    it('List with renderItem header/main/extra', () => {
        const list = renderList({
            renderItem: item => (
                <List.Item
                    header={<Avatar color="blue">SE</Avatar>}
                    main={
                        <div>
                            <span style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>示例标题</span>
                            {item}
                        </div>
                    }
                    extra={
                        <ButtonGroup theme="borderless">
                            <Button>编辑</Button>
                            <Button>更多</Button>
                        </ButtonGroup>
                    }
                />
            )
        });
        // item header
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-item-body-header .${BASE_CLASS_PREFIX}-avatar-label`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('SE');
        // item main
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-item-body-main span`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('示例标题');
        // item extra
        expect(list.exists(`.${BASE_CLASS_PREFIX}-list-item-extra .${BASE_CLASS_PREFIX}-button-group`)).toEqual(true);
        list.unmount();
    });

    it('List with className / style', () => {
        const props = {
            className: 'test',
            style: { height: 420 },
        };
        const list = renderList(props);
        expect(list.hasClass('test')).toEqual(true);
        expect(list.find('div.test')).toHaveStyle('height', 420);
        list.unmount();
    });

    it('List with bordered', () => {
        const list = renderList({ bordered: true });
        expect(list.exists(`.${BASE_CLASS_PREFIX}-list-bordered`)).toEqual(true);
        list.unmount();
    });

    it('List with size', () => {
        const smallList = renderList({ size: 'small' });
        expect(smallList.exists(`.${BASE_CLASS_PREFIX}-list-small`)).toEqual(true);
        smallList.unmount();
        const defaultList = renderList({ size: 'default' });
        expect(defaultList.exists(`.${BASE_CLASS_PREFIX}-list-default`)).toEqual(true);
        defaultList.unmount();
        const largeList = renderList({ size: 'large' });
        expect(largeList.exists(`.${BASE_CLASS_PREFIX}-list-large`)).toEqual(true);
        largeList.unmount();
    });

    it('List with layout', () => {
        const horizontalList = renderList({ layout: 'horizontal' });
        expect(horizontalList.exists(`.${BASE_CLASS_PREFIX}-list-flex`)).toEqual(true);
        horizontalList.unmount();
        const verticalList = renderList({ layout: 'vertical' });
        expect(verticalList.exists(`.${BASE_CLASS_PREFIX}-list-flex`)).toEqual(false);
        verticalList.unmount();
    });

    it('List with grid', () => {
        const list = renderList({
            grid: {
                gutter: 18,
                span: 6,
            }
        });
        const item = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-col-6`);
        expect(item.length).toEqual(4);
        expect(list.find(`.${BASE_CLASS_PREFIX}-col-6`).at(0)).toHaveStyle('paddingLeft', 9);
        expect(list.find(`.${BASE_CLASS_PREFIX}-col-6`).at(0)).toHaveStyle('paddingRight', 9);
        list.unmount();
    });

    it('List with split', () => {
        const list = renderList({ split: false });
        expect(list.exists(`.${BASE_CLASS_PREFIX}-list-split`)).toEqual(false);
        list.unmount();
    });

    it('List with onClick', () => {
        const spyOnClick = sinon.spy(() => { });
        const list = renderList({ onClick: spyOnClick });
        list.find(`.${BASE_CLASS_PREFIX}-list-item`).at(0).simulate('click');
        expect(spyOnClick.calledOnce).toBe(true);
        list.unmount();
    });


    it('List with jsx', () => {
        const spyOnClick = sinon.spy(() => { });
        const list = mount(<List>
            <List.Item onClick={spyOnClick}>从明天起，做一个幸福的人</List.Item>
            <List.Item>喂马，劈柴，周游世界</List.Item>
            <List.Item>从明天起，关心粮食和蔬菜</List.Item>
            <List.Item>我有一所房子，面朝大海，春暖花开菜</List.Item>
        </List>, {
            attachTo: document.getElementById('container'),
        });;
        list.find(`.${BASE_CLASS_PREFIX}-list-item`).at(0).simulate('click');
        expect(spyOnClick.calledOnce).toBe(true);
        list.unmount();
    });

    it('List with loading', () => {
        const loadingList = renderList({ loading: true });
        expect(loadingList.exists(`.${BASE_CLASS_PREFIX}-spin-hidden`)).toEqual(false);
        loadingList.unmount();
        const noloadingList = renderList({ loading: false });
        expect(noloadingList.exists(`.${BASE_CLASS_PREFIX}-spin-hidden`)).toEqual(true);
        noloadingList.unmount();
    });

    it('List with loadMore', () => {
        const list = renderList({ loadMore: <Button>加载更多</Button> });
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list .${BASE_CLASS_PREFIX}-button .${BASE_CLASS_PREFIX}-button-content`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('加载更多');
        list.unmount();
    });

    it('List with emptyContent', () => {
        const list = renderList({
            emptyContent: <span className='empty'>自定义空内容</span>,
            dataSource: []
        });
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-items .${BASE_CLASS_PREFIX}-list-empty .empty`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('自定义空内容');
        list.unmount();

        const list2 = renderList({
            dataSource: []
        });
        expect(
            list2
                .find(`.${BASE_CLASS_PREFIX}-list-items .${BASE_CLASS_PREFIX}-list-empty`)
                .getDOMNode()
                .textContent
        ).toEqual('暂无数据');
        list2.unmount();
    });

    it('List with footer/header', () => {
        const list = renderList({
            header: <div className='header'>头部</div>,
            footer: <div className='footer'>尾部</div>,
        });
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-header .header`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('头部');
        expect(
            list
                .find(`.${BASE_CLASS_PREFIX}-list-footer .footer`)
                .at(0)
                .getDOMNode()
                .textContent
        ).toEqual('尾部');
        list.unmount();
    });


    it('List show empty div when loading and dataSource is empty', () => {
        const list = renderList({
            dataSource: [],
            loading: true
        });
        expect(list.exists(`.${BASE_CLASS_PREFIX}-list-empty`)).toEqual(true);
        expect(list.exists(`.${BASE_CLASS_PREFIX}-spin-large`)).toEqual(true);
        list.unmount();
    });
});