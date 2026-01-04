import React from 'react';
import OverflowList from '../index';
import { Icon, Tag } from '../../index';

const ITEMS = [
    { icon: "folder-close", key: "All" },
    { icon: "folder-close", key: "Users" },
    { icon: "folder-close", key: "Janet" },
    { href: "#", icon: "folder-close", key: "Photos" },
    { href: "#", icon: "folder-close", key: "Wednesday" },
    { icon: "document", key: "image", current: true },
];
class Demo extends React.Component {
    renderOverflow = (items: any[]) => {
        // console.log('overflow items: ', items);
        return (<Tag>{items.length}</Tag>);
    }
    renderItem = (item: any, ind: number) => {
        // console.log('visible item: ', item);
        return (<span key={item.key} style={{ marginRight: 8 }}>{item.key}</span>);
    }
    render() {
        return (
            <div style={{ width: '30%' }}>
                <OverflowList
                    items={ITEMS}
                    onOverflow={(item => console.log(item))}
                    overflowRenderer={items => this.renderOverflow(items)}
                    visibleItemRenderer={this.renderItem}
                />
            </div>
        );
    }
}

export default Demo;