import React, { Component } from 'react';
import * as _ from 'lodash';
import { Nav } from '../../../index';

const navList = [
    {
        path: 'components',
        title: '所有组件',
    },
    {
        path: 'demo',
        title: '主题样例',
        children: [
            {
                path: 'demo_workstation',
                title: '工作台',
            },
        ],
    },
];

const searchToJson = (search = '') => {
    const pairs = search.substring(1).split('&');
    const obj = {};
    let pair;
    let i;

    for (i in pairs) {
        if (pairs[i] === '') continue;

        pair = pairs[i].split('=');
        obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }

    return obj;
};

const jsonToSearch = (json = {}) => {
    return Object.entries(json)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
};

export class Navbar extends Component {
    static defaultProps = {
        notifyNavChange: path => {
            const json = searchToJson(window.location.search);
            json.itemKey = path;
            window.location.search = jsonToSearch(json);
        },
    };

    constructor(props) {
        super(props);
        this.state = {
            selectedKeys: ['components'],
        };
    }

    componentDidMount() {
        this.setKey();
    }

    componentDidUpdate() {
        this.setKey();
    }

    setKey(key) {
        // const pathname = window.location.hash;
        key = key || searchToJson()['itemKey'];
        const { selectedKeys } = this.state;
        if (key && key !== selectedKeys[0]) {
            this.setState({ selectedKeys: [key] });
        }
    }

    setActive = (key, path) => {
        if (key !== this.state.selectedKeys[0]) {
            // 通知父组件变更路由，之后会触发didUpdate
            this.props.notifyNavChange(path);
            this.setState({});
        }
    };

    renderNavItem = config => {
        const { path, title, children } = config;
        let props = {
            itemKey: path,
            text: title,
            key: path,
        };
        if (children) {
            return <Nav.Sub {...props}>{children.map(sub => this.renderNavItem(sub))}</Nav.Sub>;
        }

        return <Nav.Item {...props} onClick={() => this.setActive(path, path)} />;
    };

    render() {
        let { selectedKeys } = this.state;

        return (
            <Nav className="page-nav" defaultOpenKeys={[navList[1].path]} selectedKeys={selectedKeys}>
                {navList.map(item => this.renderNavItem(item))}
                <Nav.Footer collapseButton={true} />
            </Nav>
        );
    }
}

export default Navbar;
