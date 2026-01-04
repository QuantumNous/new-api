import React from 'react';
import { Nav, Button } from '@douyinfe/semi-ui';
import { IconStar, IconSetting, IconUser } from '@douyinfe/semi-icons';

const items2 = [
    { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
    { text: '任务平台', icon: <IconSetting />, itemKey: 'job', items: ['任务管理', '用户任务查询'] },
];

class NavApp extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            items: [
                { itemKey: 'user', text: '用户管理', icon: <IconUser /> },
                { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
                { itemKey: 'job', text: '任务平台', icon: <IconSetting />, items: ['任务管理', '用户任务查询'] },
            ],
        };
        this.change = this.change.bind(this);
    }
    change() {
        if (this.state.items.length === 3) {
            this.setState({ items: items2 });
        } else {
            this.setState({ items: [] });
        }
    }
    render() {
        return (
            <>
                <Button onClick={this.change}>change items</Button>
                <br />
                <br />
                <Nav bodyStyle={{ height: 150 }} items={this.state.items} />
            </>
        );
    }
}

export default NavApp;
