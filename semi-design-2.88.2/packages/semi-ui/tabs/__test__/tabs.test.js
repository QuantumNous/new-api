import { useState } from 'react';
import { TabPane, Tabs } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

let defaultTabPane = [
    { itemKey: 'itemKeyA', tab: 'titleA', children: 'contentA' },
    { itemKey: 'itemKeyB', tab: 'titleB', children: 'contentB' }
]

let ACTIVE = `.${BASE_CLASS_PREFIX}-tabs-tab-active`;

function getTabs(tabProps, tabPaneProps = defaultTabPane) {
    let tabPane = tabPaneProps.map(pane => {
        return <TabPane {...pane} key={pane.itemKey}></TabPane>
    });
    return <Tabs {...tabProps}>
        {tabPane}
    </Tabs>
}

describe('Tabs', () => {

    it('tabs render basicly', () => {
        let props = {};
        const tabs = mount(getTabs(props, defaultTabPane))
        // render in same time
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-content`).children().length).toEqual(2);
        // default active first pane
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab-active`).text()).toEqual('titleA');
    });

    it('Tabs with custom className & style & contentStyle', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red'
            }
        };
        const tabs = shallow(getTabs(props));
        expect(tabs.exists('.test')).toEqual(true);
        expect(tabs.find('div.test')).toHaveStyle('color', 'red');
    });

    it('Tabs with defaultActiveKey', () => {
        let tabProps = {
            defaultActiveKey: 'itemKeyB'
        };
        const tabs = mount(getTabs(tabProps));
        const activeTabContent = tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab-active`).text();
        expect(activeTabContent).toEqual('titleB');
    });

    it('different type Tabs', () => {
        let lineTabs = mount(getTabs({ type: 'line' }));
        let cardTabs = mount(getTabs({ type: 'card' }));
        let buttonTabs = mount(getTabs({ type: 'button' }));
        expect(lineTabs.exists(`.${BASE_CLASS_PREFIX}-tabs-bar-button`)).toEqual(false);
        expect(lineTabs.exists(`.${BASE_CLASS_PREFIX}-tabs-bar-card`)).toEqual(false);
        expect(cardTabs.exists(`.${BASE_CLASS_PREFIX}-tabs-bar-card`)).toEqual(true);
        expect(buttonTabs.exists(`.${BASE_CLASS_PREFIX}-tabs-bar-button`)).toEqual(true);
    });

    it('tabList', () => {
        let tabList = [
            { tab: "文档", itemKey: "1" },
            { tab: "快速起步", itemKey: "2" },
            { tab: "帮助", itemKey: "3" }
        ];
        const contentList = [
            (<div>文档</div>),
            (<div>快速起步</div>),
            (<div>帮助</div>)
        ]

        class TabListDemo extends React.Component {
            state = {
                key: '1'
            };

            render() {
                return (
                    <Tabs
                        tabList={tabList}
                    >
                        {contentList[this.state.key - 1]}
                    </Tabs>
                )
            }
        }

        const tabs = mount(<TabListDemo></TabListDemo>);
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-content`).children().length).toEqual(1);
    })

    it('should not toggle whenn clicked disabled pane', () => {
        let spyOnChange = sinon.spy((activeKey) => {
        })
        let tabProps = {
            defaultActiveKey: 'itemKeyA',
            onChange: spyOnChange
        };
        let tabPaneProps = [
            { itemKey: 'itemKeyA', tab: 'titleA' },
            { itemKey: 'itemKeyB', tab: 'titleB', disabled: true },
        ];
        let tabs = mount(getTabs(tabProps, tabPaneProps));
        expect(tabs.exists(`.${BASE_CLASS_PREFIX}-tabs-tab-disabled`)).toEqual(true);
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab-disabled`).text()).toEqual('titleB');

        tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(1).simulate('click');
        expect(spyOnChange.calledOnce).toBe(false);
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab-active`).text()).toEqual('titleA');
    });

    it('onTabClick', () => {
        let onTabClick = (key, e) => {
            // debugger
        };
        let spyOnTabClick = sinon.spy(onTabClick);
        let props = {
            onTabClick: spyOnTabClick
        };
        const tabs = mount(getTabs(props));
        tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(1).simulate('click');
        expect(spyOnTabClick.calledWithMatch("itemKeyB")).toBe(true);
        expect(spyOnTabClick.calledOnce).toBe(true);
    });

    it('onChange', () => {
        let onChange = value => {
            // debugger
        };
        let spyOnChange = sinon.spy(onChange);
        let tabsProps = {
            onChange: spyOnChange
        };
        let paneProps = defaultTabPane;
        const tabs = mount(getTabs(tabsProps, paneProps));
        tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(1).simulate('click');
        expect(spyOnChange.calledWithMatch("itemKeyB")).toBe(true);
        expect(spyOnChange.calledOnce).toBe(true);
    });

    it('should update when activeKey change', () => {
        let tabsProps = {
            activeKey: 'itemKeyA'
        };
        const tabs = mount(getTabs(tabsProps, defaultTabPane));
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab-active`).text()).toEqual('titleA');
        tabs.setProps({ activeKey: 'itemKeyB' });
        tabs.update()
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-tab-active`).text()).toEqual('titleB');
    });

    it('contentStyle', () => {
        let tabsProps = {
            contentStyle: {
                color: 'red'
            }
        };
        const tabs = mount(getTabs(tabsProps, defaultTabPane));
        expect(tabs.find(`.${BASE_CLASS_PREFIX}-tabs-content`)).toHaveStyle('color', 'red');
    });

    it('tarBarExtraContent', () => {
        let extraContent = (<div className='extra'>Extra</div>);
        let tabsProps = {
            tabBarExtraContent: extraContent
        };
        const tabs = mount(getTabs(tabsProps, defaultTabPane));
        expect(tabs.contains(extraContent)).toEqual(true);
    });

    it('tabpane closable', () => {
        const Demo = () => {
            const [tabList, $tabList] = useState([
                {tab: '文档', itemKey:'1', text:'文档', closable:true},
                {tab: '快速起步', itemKey:'2', text:'快速起步', closable:true},
                {tab: '帮助', itemKey:'3', text:'帮助'},
            ]);
            const close = (key)=>{
                const newTabList = [...tabList];
                const closeIndex = newTabList.findIndex(t=>t.itemKey===key);
                newTabList.splice(closeIndex, 1);
                $tabList(newTabList);
            }
            return <Tabs type="card" defaultActiveKey="1" onTabClose={close}>
            {
                tabList.map(t=><TabPane closable={t.closable} tab={t.tab} itemKey={t.itemKey} key={t.itemKey}>{t.text}</TabPane>)
            }
        </Tabs>
        }

        const demo = mount(<Demo />);
        const firstTab = demo.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(0);
        const secondTab = demo.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(1);
        const thirdTab = demo.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(2);

        expect(firstTab.exists(`.${BASE_CLASS_PREFIX}-tabs-tab-icon-close`)).toEqual(true);
        expect(secondTab.exists(`.${BASE_CLASS_PREFIX}-tabs-tab-icon-close`)).toEqual(true);
        expect(thirdTab.exists(`.${BASE_CLASS_PREFIX}-tabs-tab-icon-close`)).toEqual(false);

        demo.find(`.${BASE_CLASS_PREFIX}-tabs-tab-icon-close`).at(0).simulate('click');

        expect(demo.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).length).toEqual(2)
        expect(demo.find(`.${BASE_CLASS_PREFIX}-tabs-tab`).at(0).hasClass(`${BASE_CLASS_PREFIX}-tabs-tab-active`)).toEqual(true);
    });

    it('tabbar renders correctly on the first render', () => {
        let props = {};
        const tabs = render(getTabs(props));
        expect(tabs.text()).toContain('titleA');
        expect(tabs.text()).toContain('titleB');
    });
})
