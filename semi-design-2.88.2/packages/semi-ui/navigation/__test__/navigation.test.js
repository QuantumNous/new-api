import Nav from '../index';
import { clear } from 'jest-date-mock';
import { genBeforeEach, genAfterEach, mount } from '@douyinfe/semi-ui/_test_/utils/tooltip';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { noop } from 'lodash';

describe(`Navigation`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test appearance`, async () => {
        const items = [
            { itemKey: 'user', text: '用户管理' },
            { itemKey: 'union', text: '公会中心' },
            {
                itemKey: 'union-management',
                text: '公会管理',
                items: ['公告设置', '公会查询', '信息录入'],
            },
            {
                text: '任务平台',
                itemKey: 'job',
                items: ['任务管理', '用户任务查询'],
            },
        ];

        const nav = mount(
            <Nav
                defaultOpenKeys={['job']}
                bodyStyle={{ height: 320 }}
                items={items}
                onSelect={key => console.log(key)}
                header={{
                    logo: <img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwzthlaukjlkulzlp/root-web-sites/webcast_logo.svg" />,
                    text: 'Semi 运营后台',
                }}
                footer={{
                    collapseButton: true,
                }}
            />
        );

        // check if has header logo
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-header-logo`).length > 0).toBeTruthy();
        // check if has header text
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-header-text`).length > 0).toBeTruthy();
        // check if has opened sub navigation
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-item-sub .${BASE_CLASS_PREFIX}-navigation-sub-open`).length > 0
        ).toBeTruthy();
        // check if has correct navigation items
        expect(
            document.querySelector(`.${BASE_CLASS_PREFIX}-navigation .${BASE_CLASS_PREFIX}-navigation-list`).children.length === items.length
        ).toBeTruthy();
        // check if has correct collapsed button
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-footer .${BASE_CLASS_PREFIX}-navigation-collapse-btn`).length > 0
        ).toBeTruthy();
    });

    it(`test appearance with jsx definitions`, async () => {
        const defaultOpenKeys = ['user'];
        const nav = mount(
            <Nav
                bodyStyle={{ height: 320 }}
                defaultOpenKeys={defaultOpenKeys}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
            >
                <Nav.Header logo={'bytedance_logo'} text={'Semi 运营后台'} />
                <Nav.Item itemKey={'union'} text={'公会中心'} icon={'star'} />
                <Nav.Sub itemKey={'user'} text="用户管理" icon="user">
                    <Nav.Item itemKey={'golder'} text={'金主管理'} />
                    <Nav.Item itemKey={'ban'} text={'用户封禁'} />
                </Nav.Sub>
                <Nav.Sub itemKey={'union-management'} text="公会管理" icon="user_group">
                    <Nav.Item itemKey={'notice'} text={'公告设置'} />
                    <Nav.Item itemKey={'query'} text={'公会查询'} />
                    <Nav.Item itemKey={'info'} text={'信息录入'} />
                </Nav.Sub>
                <Nav.Footer collapseButton={true} />
            </Nav>
        );

        // check if has header logo
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-header-logo`).length > 0).toBeTruthy();
        // check if has header text
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-header-text`).length > 0).toBeTruthy();
        // check if has opened sub navigation
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-item-sub .${BASE_CLASS_PREFIX}-navigation-sub-open`).length > 0
        ).toBeTruthy();
        // check if has correct navigation items
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-navigation .${BASE_CLASS_PREFIX}-navigation-list`).children.length === 3).toBeTruthy();
        // check if has correct collapsed button
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-footer .${BASE_CLASS_PREFIX}-navigation-collapse-btn`).length > 0
        ).toBeTruthy();
    });

    it(`test horizontal nav appearance`, async () => {
        const onSelect = sinon.spy();
        const onClick = sinon.spy();
        const items = [
            { itemKey: 'user', text: '用户管理' },
            { itemKey: 'union', text: '公会中心' },
            {
                itemKey: 'approve-management',
                text: '审批管理',
                items: [
                    '入驻审核',
                    {
                        itemKey: 'operation-management',
                        text: '运营管理',
                        items: ['人员管理', '人员变更'],
                    },
                ],
            },
            {
                text: '任务平台',
                itemKey: 'job',
                items: ['任务管理', '用户任务查询'],
            },
        ];

        const nav = mount(
            <Nav
                mode={'horizontal'}
                onSelect={onSelect}
                onClick={onClick}
                items={items}
                header={{
                    logo: 'bytedance_logo',
                    text: 'Semi 运营后台',
                }}
                footer={{ collapseButton: true }}
            />
        );

        // check if has header logo
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-header-logo`).length > 0).toBeTruthy();
        // check if has header text
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-header-text`).length > 0).toBeTruthy();
        // check if has opened sub navigation
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-item-sub`).length > 0).toBeTruthy();
        // check if has correct navigation items
        expect(
            document.querySelector(`.${BASE_CLASS_PREFIX}-navigation .${BASE_CLASS_PREFIX}-navigation-list`).children.length === items.length
        ).toBeTruthy();
        // check if has correct collapsed button
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-footer .${BASE_CLASS_PREFIX}-navigation-collapse-btn`).length === 0
        ).toBeTruthy();
    });

    it(`test controlled selected and open`, async () => {
        const items = [
            { itemKey: 'user', text: '用户管理', icon: 'user' },
            { itemKey: 'union', text: '公会中心', icon: 'star' },
            {
                itemKey: 'union-management',
                text: '公会管理',
                icon: 'user_group',
                items: ['公告设置', '公会查询', '信息录入'],
            },
            {
                text: '任务平台',
                icon: 'setting',
                itemKey: 'job',
                items: ['任务管理', '用户任务查询'],
            },
        ];

        const openKeys = ['union-management', 'job'];
        const selectedKeys = ['用户任务查询'];
        const isCollapsed = false;

        const onSelect = sinon.spy(({ selectedKeys }) =>
            nav.setProps({
                selectedKeys,
            })
        );
        const onOpenChange = sinon.spy(({ openKeys }) => nav.setProps({ openKeys }));
        const onCollapseChange = sinon.spy(isCollapsed => nav.setProps({ isCollapsed }));
        const onClick = sinon.spy(() => {});

        const nav = mount(
            <Nav
                openKeys={openKeys}
                bodyStyle={{ height: 320 }}
                items={items}
                onOpenChange={onOpenChange}
                selectedKeys={selectedKeys}
                onSelect={onSelect}
                isCollapsed={isCollapsed}
                onCollapseChange={onCollapseChange}
                onClick={onClick}
                header={{
                    logo: <img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwzthlaukjlkulzlp/root-web-sites/webcast_logo.svg" />,
                    text: 'Semi 运营后台',
                }}
                footer={{
                    collapseButton: true,
                }}
            />
        );

        // close first opened navigation list
        document.querySelector(`.${BASE_CLASS_PREFIX}-navigation-sub-title`).click();
        expect(onOpenChange.called).toBeTruthy();
        expect(nav.prop('openKeys').length === openKeys.length - 1).toBeTruthy();

        // select first opened sub menu list's first item
        document.querySelector(`.${BASE_CLASS_PREFIX}-navigation-sub-open`).children[0].click();
        expect(onSelect.called).toBeTruthy();
        expect(nav.prop('selectedKeys').length === 1).toBeTruthy();

        // click collpase button
        document.querySelector(`.${BASE_CLASS_PREFIX}-navigation-collapse-btn button`).click();
        expect(onCollapseChange.called).toBeTruthy();
        expect(document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-collapsed`).length === 1).toBeTruthy();
    });

    it(`test function call parameter`, async () => {
        const onSelect = sinon.spy(noop);
        const onOpenChange = sinon.spy(noop);
        const onCollapseChange = sinon.spy(noop);
        const onClick = sinon.spy(noop);

        const nav = mount(
            <Nav
                bodyStyle={{ height: 320 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: 'user' },
                    { itemKey: 'union', text: '公会中心', icon: 'star' },
                    {
                        text: '任务平台',
                        icon: 'setting',
                        itemKey: 'job',
                        items: ['任务管理', '用户任务查询'],
                    },
                ]}
                onSelect={onSelect}
                onOpenChange={onOpenChange}
                onCollapseChange={onCollapseChange}
                onClick={onClick}
                footer={{
                    collapseButton: true,
                }}
            />
        );

        const subTitle = nav.find(`.${BASE_CLASS_PREFIX}-navigation-sub-title`);
        subTitle.simulate('click');
        expect(onClick.called).toBeTruthy();
        expect(onOpenChange.called).toBeTruthy();
        expect(onClick.getCall(0).args[0].itemKey).toEqual('job');
        expect(onOpenChange.getCall(0).args[0].itemKey).toEqual('job');

        const firstItem = nav.find(`.${BASE_CLASS_PREFIX}-navigation-item`).at(0);
        firstItem.simulate('click');
        expect(onSelect.called).toBeTruthy();
        expect(onSelect.getCall(0).args[0].itemKey).toEqual('user');

        const collpaseBtn = nav.find(`.${BASE_CLASS_PREFIX}-navigation-collapse-btn button`).at(0);
        collpaseBtn.simulate('click');
        expect(onCollapseChange.called).toBeTruthy();
        expect(onCollapseChange.getCall(0).args[0]).toEqual(true);
    });

    it(`test itemKey is a number type expansion`, async () => {
        const onSelect = sinon.spy(noop);
        const onOpenChange = sinon.spy(noop);
        const onCollapseChange = sinon.spy(noop);
        const onClick = sinon.spy(noop);

        const nav = mount(
            <Nav
                bodyStyle={{ height: 320 }}
                items={[
                    { itemKey: 'user', text: '用户管理', icon: 'user' },
                    { itemKey: 'union', text: '公会中心', icon: 'star' },
                    {
                        text: '任务平台',
                        icon: 'setting',
                        itemKey: 2,
                        items: ['任务管理', '用户任务查询'],
                    },
                ]}
                onSelect={onSelect}
                onOpenChange={onOpenChange}
                onCollapseChange={onCollapseChange}
                onClick={onClick}
                footer={{
                    collapseButton: true,
                }}
            />
        );

        const subTitle = nav.find(`.${BASE_CLASS_PREFIX}-navigation-sub-title`);
        subTitle.simulate('click');
        expect(onClick.called).toBeTruthy();
        expect(onOpenChange.called).toBeTruthy();
        expect(onClick.getCall(0).args[0].itemKey).toEqual(2);
        expect(onOpenChange.getCall(0).args[0].itemKey).toEqual(2);
        expect(
            document.querySelectorAll(`.${BASE_CLASS_PREFIX}-navigation-item-sub .${BASE_CLASS_PREFIX}-navigation-sub-open`).length > 0
        ).toBeTruthy();
    });
});
