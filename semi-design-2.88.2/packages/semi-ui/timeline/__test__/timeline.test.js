import { Timeline, Icon } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const dataSource = [
    {
        time: '2019-07-14 10:35',
        extra: '节点辅助说明信息',
        content: '第一个节点内容',
        type: 'ongoing',
    },
    {
        time: '2019-06-13 16:17',
        extra: '节点辅助说明信息',
        content: <span style={{ fontSize: '18px' }}>第二个节点内容</span>,
        color: 'pink',
    },
    {
        time: '2019-05-14 18:34',
        extra: '节点辅助说明信息',
        dot: <Icon type="alert_triangle" />,
        content: '第三个节点内容',
        type: 'warning',
    },
    {
        time: '2019-05-09 09:12',
        extra: '节点辅助说明信息',
        content: '第四个节点内容',
        type: 'success',
    },
];

function renderTl(props) {
    const realProps = {
        dataSource,
        ...props,
    };
    return mount(<Timeline {...realProps}></Timeline>, {
        attachTo: document.getElementById('container'),
    });
}

describe('Timeline', () => {

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

    it('Timeline with dataSource', () => {
        const timeline = renderTl();
        const item = document.querySelectorAll(`.${BASE_CLASS_PREFIX}-timeline-item`);
        expect(item.length).toEqual(4);
        const firstItem = timeline.find(`.${BASE_CLASS_PREFIX}-timeline-item .${BASE_CLASS_PREFIX}-timeline-item-content`).at(0);
        // content
        expect(
            firstItem
                .getDOMNode()
                .textContent
        ).toEqual('第一个节点内容节点辅助说明信息2019-07-14 10:35');
        // extra
        expect(
            firstItem
                .find(`.${BASE_CLASS_PREFIX}-timeline-item-content-extra`)
                .getDOMNode()
                .textContent
        ).toEqual('节点辅助说明信息');
        // time
        expect(
            firstItem
                .find(`.${BASE_CLASS_PREFIX}-timeline-item-content-time`)
                .getDOMNode()
                .textContent
        ).toEqual('2019-07-14 10:35');
        // type
        expect(
            timeline
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item .${BASE_CLASS_PREFIX}-timeline-item-head-ongoing`)
        ).toEqual(true);
        timeline.unmount();
    });

    it('Timeline with jsx',()=>{
        const timeline=mount(<Timeline>
            <Timeline.Item time="2019-07-14 10:35">第一个节点内容</Timeline.Item>
            <Timeline.Item time="2019-06-13 16:17">第二个节点内容</Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34">第三个节点内容</Timeline.Item>
        </Timeline>, {
            attachTo: document.getElementById('container'),
        });
        const firstItem = timeline.find(`.${BASE_CLASS_PREFIX}-timeline-item .${BASE_CLASS_PREFIX}-timeline-item-content`).at(0);
        expect(
            firstItem
                .getDOMNode()
                .textContent
        ).toEqual('第一个节点内容2019-07-14 10:35');
        timeline.unmount();
    });

    it('Timeline with type',()=>{
        const timeline=mount(<Timeline>
            <Timeline.Item time="2019-07-14 10:35" type='default'>第一个节点内容</Timeline.Item>
            <Timeline.Item time="2019-06-13 16:17" type='ongoing'>第二个节点内容</Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34" type='success'>第三个节点内容</Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34" type='warning'>第四个节点内容</Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34" type='error'>第五个节点内容</Timeline.Item>
        </Timeline>, {
            attachTo: document.getElementById('container'),
        });
        const items = timeline.find(`.${BASE_CLASS_PREFIX}-timeline-item`);
        expect(items.length).toEqual(5);
        expect(
            items
            .at(0)
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item-head-default`)
        ).toEqual(true);
        expect(
            items
            .at(1)
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item-head-ongoing`)
        ).toEqual(true);
        expect(
            items
            .at(2)
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item-head-success`)
        ).toEqual(true);
        expect(
            items
            .at(3)
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item-head-warning`)
        ).toEqual(true);
        expect(
            items
            .at(4)
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item-head-error`)
        ).toEqual(true);
        timeline.unmount();
    });

    it('Timeline with className & style', () => {
        const timeline=mount(<Timeline className='test' style={{color: 'red'}}>
            <Timeline.Item time="2019-07-14 10:35" type='default'>第一个节点内容</Timeline.Item>
            <Timeline.Item time="2019-06-13 16:17" type='ongoing'>第二个节点内容</Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34" type='success'>第三个节点内容</Timeline.Item>
        </Timeline>, {
            attachTo: document.getElementById('container'),
        });
        expect(timeline.exists('.test')).toEqual(true);
        expect(timeline.find(`.${BASE_CLASS_PREFIX}-timeline.test`)).toHaveStyle('color', 'red');
    });

    it('Timeline.item with className & style', () => {
        const timeline=mount(<Timeline>
            <Timeline.Item time="2019-07-14 10:35" type='default' className='test' style={{color: 'red'}}>第一个节点内容</Timeline.Item>
            <Timeline.Item time="2019-06-13 16:17" type='ongoing'>第二个节点内容</Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34" type='success'>第三个节点内容</Timeline.Item>
        </Timeline>, {
            attachTo: document.getElementById('container'),
        });
        const firstItems = timeline.find(`.${BASE_CLASS_PREFIX}-timeline-item`).at(0);
        expect(firstItems.find(`.${BASE_CLASS_PREFIX}-timeline-item.test`)).toHaveStyle('color', 'red');
        expect(firstItems.exists('.test')).toEqual(true);
    });

    it('Timeline with type',()=>{
        const timeline=mount(<Timeline>
            <Timeline.Item time="2019-07-14 10:35">默认样式的节点</Timeline.Item>
            <Timeline.Item time="2019-06-13 16:17" dot="a" type="warning">
                自定义图标
            </Timeline.Item>
            <Timeline.Item time="2019-05-14 18:34" color="pink">
                自定义节点颜色
            </Timeline.Item>
        </Timeline>, {
            attachTo: document.getElementById('container'),
        });
        const items = timeline.find(`.${BASE_CLASS_PREFIX}-timeline-item`);
        expect(
            items
            .at(0)
            .exists(`.${BASE_CLASS_PREFIX}-timeline-item-head-default`)
        ).toEqual(true);
        expect(
            items
            .at(1)
            .find(`.${BASE_CLASS_PREFIX}-timeline-item-head`)
            .getDOMNode()
            .textContent
        ).toEqual('a');
        expect(
            items
            .at(2)
            .find(`.${BASE_CLASS_PREFIX}-timeline-item-head-default`)
        ).toHaveStyle('backgroundColor', 'pink');
        timeline.unmount();
    });

    it('Timeline with mode',()=>{
        const timelineLeft = renderTl({mode:'left'});
        expect(
            timelineLeft
            .find(`.${BASE_CLASS_PREFIX}-timeline-left`)
            .length
        ).toEqual(1);
        timelineLeft.unmount();
        const timelineCenter = renderTl({mode:'center'});
        expect(
            timelineCenter
            .find(`.${BASE_CLASS_PREFIX}-timeline-center`)
            .length
        ).toEqual(1);
        timelineCenter.unmount();
        const timelineAlternate = renderTl({mode:'alternate'});
        expect(
            timelineAlternate
            .find(`.${BASE_CLASS_PREFIX}-timeline-alternate`)
            .length
        ).toEqual(1);
        timelineAlternate.unmount();
        const timelineRight = renderTl({mode:'right'});
        expect(
            timelineRight
            .find(`.${BASE_CLASS_PREFIX}-timeline-right`)
            .length
        ).toEqual(1);
        timelineRight.unmount();
    });

  it('Timeline with time type ReactNode',()=>{
    const timeline=mount(<Timeline>
      <Timeline.Item time={<span>2019-07-14 10:35</span>}>第一个节点内容</Timeline.Item>
      <Timeline.Item time="2019-06-13 16:17">第二个节点内容</Timeline.Item>
    </Timeline>, {
      attachTo: document.getElementById('container'),
    });
    const firstItem = timeline.find(`.${BASE_CLASS_PREFIX}-timeline-item .${BASE_CLASS_PREFIX}-timeline-item-content .${BASE_CLASS_PREFIX}-timeline-item-content-time`).at(0);
    expect(
      firstItem
        .getDOMNode()
        .innerHTML
    ).toEqual('<span>2019-07-14 10:35</span>');
    timeline.unmount();
  });

});
