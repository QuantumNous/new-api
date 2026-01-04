import { Breadcrumb } from '../../index';
import { IconHome, IconArticle } from '@douyinfe/semi-icons';

function getBr(props = {}) {
    let children
    if (props.children) {
        children = props.children.map(childProp => <Breadcrumb.Item {...childProp}></Breadcrumb.Item>)
    } else {
        children = [
            <Breadcrumb.Item>semi</Breadcrumb.Item>,
            <Breadcrumb.Item>design</Breadcrumb.Item>,
            <Breadcrumb.Item>byde</Breadcrumb.Item>
        ]
    }

    return mount(<Breadcrumb {...props}>{children}</Breadcrumb>, { attachTo: document.getElementById('container') });
}

describe('Breadcrumb', () => {
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

    it('custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const wrapper = getBr(props);
        expect(wrapper.hasClass('test')).toEqual(true);
        expect(wrapper.find('nav.test')).toHaveStyle('color', 'red');
    });

    it('compact = false', () => {
        let props = {
            compact: false,
        };
        let br = getBr(props);
        expect(br.exists('.semi-breadcrumb-wrapper-loose')).toEqual(true);
        expect(br.exists('.semi-breadcrumb-wrapper-compact')).toEqual(false);
        br.unmount();
        let br2 = getBr();
        expect(br2.exists('.semi-breadcrumb-wrapper-compact')).toEqual(true);
        expect(br2.exists('.semi-breadcrumb-wrapper-loose')).toEqual(false);
    });

    it('separator', () => {
        let props = {
            separator: '>'
        };
        let br = getBr(props);
        expect(br.find('.semi-breadcrumb-separator').children().at(0).text()).toEqual('>')
        expect(br.find('.semi-breadcrumb-separator').children().at(1).text()).toEqual('>')
    });

    it('maxItemCount', () => {
        let props = {
            maxItemCount: 3,
            children: [
                { children: 'semi' },
                { children: 'design' },
                { children: 'powered' },
                { children: 'by' },
                { children: 'douyin' },
            ]
        };
        let br = getBr(props);
        expect(br.find('.semi-breadcrumb-wrapper').children().length).toEqual(4); // semi/.../by/douyin
        expect(br.find('.semi-breadcrumb-item-wrap .semi-typography').children().at(0).text()).toEqual('semi');
        expect(br.exists('.semi-breadcrumb-collapse .semi-icon-more')).toEqual(true);
        expect(br.find('.semi-breadcrumb-item-wrap .semi-typography').children().at(1).text()).toEqual('by');
        expect(br.find('.semi-breadcrumb-item-wrap .semi-typography').children().at(2).text()).toEqual('douyin');

    });

    it('Item icon/href/noLink/separator', () => {
        let href = 'https://semi.design'
        let props = {
            children: [
                { icon: <IconHome />, separator: '???', children: 'semi' },
                { icon: <IconArticle />, children: 'design', href },
                { children: 'system', href: null },
            ]
        };
        let br = getBr(props);
        expect(br.exists('.semi-icon-home')).toEqual(true);
        expect(br.exists('.semi-icon-article')).toEqual(true);
        expect(br.find('.semi-breadcrumb-item-wrap a').getDOMNode().getAttribute("href")).toEqual(href);
        // when setting separator in item props, will not wrap in .semi-breadcrumb-separator
        expect(br.find('.semi-breadcrumb-item-wrap').at(0).children().at(1).text()).toEqual('???')
        expect(br.find('.semi-breadcrumb-separator').children().at(0).text()).toEqual('/')
    });


    it('onClick & item.onClick', () => {
        let spyClick = sinon.spy((item, e) => {
        });
        let spyItemClick = sinon.spy((item, e) => {

        });
        let props = {
            onClick: spyClick,
            children: [
                { onClick: spyItemClick, children: 'semi' },
                { children: 'design' },
            ]
        };
        let br = getBr(props);
        br.find('.semi-breadcrumb-item-wrap').children().at(0).simulate('click', {});
        expect(spyItemClick.calledOnce).toEqual(true);
        expect(spyClick.calledOnce).toEqual(true);
        let firstCall = spyClick.getCall(0);
        let firstArgs = firstCall.args;
        expect(firstArgs[0]).toEqual({ name: 'semi' });
        expect(firstArgs[1].constructor.name === 'SyntheticEvent').toEqual(true);
        expect(firstArgs.length === 2).toEqual(true);

        let itemCall = spyItemClick.getCall(0);
        let itemArgs = itemCall.args;
        expect(itemArgs[0]).toEqual({ name: 'semi' });
        expect(itemArgs[1].constructor.name === 'SyntheticEvent').toEqual(true);
        expect(itemArgs.length === 2).toEqual(true);
    });
    
    it('routes', () => {
        // object routes & string routes hybrid
        const objRoutes = [
            {
                path: '/',
                href: '/',
                icon: <IconHome />
            },
            {
                path: '/breadcrumb',
                href: '/components/breadcrumb',
                name: 'breadcrumb',
                icon: <IconArticle />
            },
            'string only'
        ];
        let props = {
            routes: objRoutes
        }
        let br = getBr(props);
        let fisrtItem = br.find('.semi-breadcrumb-item-wrap').at(0);
        let secondItem = br.find('.semi-breadcrumb-item-wrap').at(1);
        let thirdItem = br.find('.semi-breadcrumb-item-wrap').at(2);
        expect(fisrtItem.exists('.semi-icon-home')).toEqual(true);
        expect(secondItem.exists('.semi-icon-article')).toEqual(true);

        expect(fisrtItem.find('.semi-breadcrumb-item-wrap a').getDOMNode().getAttribute("href")).toEqual('/');
        expect(secondItem.find('.semi-breadcrumb-item-wrap a').getDOMNode().getAttribute("href")).toEqual('/components/breadcrumb');

        expect(secondItem.find('.semi-breadcrumb-item-wrap .semi-typography').text()).toEqual('breadcrumb');
        expect(thirdItem.find('.semi-breadcrumb-item-wrap .semi-typography').text()).toEqual('string only');
    });

    it('renderItem', () => {
        const objRoutes = [
            {
                path: 'path',
                href: 'href',
                name: 'test',
                icon: <IconHome />,
            }
        ];
        
        let props = {
            routes: objRoutes,
            renderItem: (route) => (
                <>
                    <div className='path'>{route.path}</div>
                    <div className='href'>{route.href}</div>
                    <div className='name'>{route.name}</div>
                </>
            )
        }
        let br = getBr(props);
        let item = br.find('.semi-breadcrumb-item-title');
        expect(item.find('.path').text()).toEqual('path');
        expect(item.find('.href').text()).toEqual('href');
        expect(item.find('.name').text()).toEqual('test');
    });

    // it('renderMore + moreType', () => {
        // let props = {
        //     maxItemCount: 3,
        //     children: [
        //         { children: 'semi' },
        //         { children: 'design' },
        //         { children: 'powered' },
        //         { children: 'by' },
        //         { children: 'douyin' },
        //     ],
        //     renderMore: (restItem) => <div>rest</div>
        // };
        // let br = getBr(props);
        // expect(br.find('.semi-breadcrumb-collapse')).toEqual(true);
    // });

    // it('autoCollapse', () => {
    // });

    // not easy to test tooltip in jest unit test, ignore
    // it('showTooltip', () => {
    // });
});
