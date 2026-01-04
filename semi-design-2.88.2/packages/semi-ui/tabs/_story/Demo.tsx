import React from 'react';
import Tabs from '../index';
import TabPane from '../TabPane';

const Demo = () => {
    const tabPaneList = [
        'a',
        'b',
        'c'
    ];

    return (
        <div>
            <Tabs 
                defaultActiveKey="1"
                renderTabBar={(tabBarProps, DefaultTabBar) => {
                    return (
                        <div className="tab-bar-box">
                            这是二次封装的Tab Bar，当前ActiveKey：{tabBarProps.activeKey}
                            <DefaultTabBar {...tabBarProps} />
                        </div>
                    );
                }}
                tabPaneMotion>
                {
                    tabPaneList.map((item, index) => {
                        return (
                            <TabPane tab={item} itemKey={index.toString()} key={item}>
                                { item + index }
                            </TabPane>
                        );
                    })
                }
            </Tabs>
        </div>
    );
};

export default Demo;