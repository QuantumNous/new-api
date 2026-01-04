import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';
import Avatar from '../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const avartarPrefix = `${BASE_CLASS_PREFIX}-avatar`

describe('Avatar', () => {
    it('size', () => {
        const element = (
                <div>
        <Avatar size="extra-extra-small" style={{ margin: 4 }}>
            U
        </Avatar>
        <Avatar size="extra-small" style={{ margin: 4 }}>
            U
        </Avatar>
        <Avatar size="small" style={{ margin: 4 }}>
            U
        </Avatar>
        <Avatar size="default" style={{ margin: 4 }}>
            U
        </Avatar>
        <Avatar style={{ margin: 4 }}>U</Avatar>
        <Avatar size="large" style={{ margin: 4 }}>
            U
        </Avatar>
        <Avatar size="extra-large" style={{ margin: 4 }}>
            U
        </Avatar>
    </div>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(1)
                .find(`.${avartarPrefix}-extra-extra-small`)
                .length
        ).toEqual(0);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(0)
                .find(`.${avartarPrefix}-extra-extra-small`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(1)
                .find(`.${avartarPrefix}-extra-small`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(2)
                .find(`.${avartarPrefix}-small`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(3)
                .find(`.${avartarPrefix}-default`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(4)
                .find(`.${avartarPrefix}-medium`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(5)
                .find(`.${avartarPrefix}-large`)
                .length
        ).toEqual(1);
    });

    it('color', () => {
        const element = (
            <div>
                <Avatar color="amber" style={{ margin: 4 }}>
                    BM
                </Avatar>
                <Avatar color="blue" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="cyan" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="green" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="grey" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="indigo" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="light-blue" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="light-green" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="lime" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="orange" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="pink" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="purple" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="red" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="teal" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="violet" style={{ margin: 4 }}>
                    TJ
                </Avatar>
                <Avatar color="yellow" style={{ margin: 4 }}>
                    TJ
                </Avatar>
            </div>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(1)
                .find(`.${avartarPrefix}-amber`)
                .length
        ).toEqual(0);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(0)
                .find(`.${avartarPrefix}-amber`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(1)
                .find(`.${avartarPrefix}-blue`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(2)
                .find(`.${avartarPrefix}-cyan`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(3)
                .find(`.${avartarPrefix}-green`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(4)
                .find(`.${avartarPrefix}-grey`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(5)
                .find(`.${avartarPrefix}-indigo`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(6)
                .find(`.${avartarPrefix}-light-blue`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(7)
                .find(`.${avartarPrefix}-light-green`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(8)
                .find(`.${avartarPrefix}-lime`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(9)
                .find(`.${avartarPrefix}-orange`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(10)
                .find(`.${avartarPrefix}-pink`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(11)
                .find(`.${avartarPrefix}-purple`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(12)
                .find(`.${avartarPrefix}-red`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(13)
                .find(`.${avartarPrefix}-teal`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(14)
                .find(`.${avartarPrefix}-violet`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(15)
                .find(`.${avartarPrefix}-yellow`)
                .length
        ).toEqual(1);
    });

    it('src', () => {
        const element = (
           <Avatar
                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png"
                style={{ margin: 4 }}
            />
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find('img')
                .at(0)
                .props()
                .src
        ).toEqual('https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png');
    });

    it('shape', () => {
        const element = (
            <div>
                <Avatar style={{ margin: 4 }}>U</Avatar>
                <Avatar shape="square" style={{ margin: 4 }}>
                    U
                </Avatar>
            </div>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(1)
                .find(`.${avartarPrefix}-circle`)
                .length
        ).toEqual(0);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(0)
                .find(`.${avartarPrefix}-circle`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${avartarPrefix}`)
                .at(1)
                .find(`.${avartarPrefix}-square`)
                .length
        ).toEqual(1);
    });

    it('className & style', () => {
        const wrapper = mount(<Avatar className='test-avatar' style={{color: 'red'}}>A</Avatar>);
        expect(wrapper.exists('.test-avatar')).toEqual(true);
        expect(wrapper.find('.test-avatar').at(0)).toHaveStyle('color', 'red');
    });

    it('gap & scale', () => {
        const gap = 10
        const wrapper = mount(<Avatar gap={gap}>Semi</Avatar>);
        expect(wrapper.find(`.${avartarPrefix}-content`).at(0)).toHaveStyle({
            'transform': expect.stringMatching(/scale\((1|0\.\d+)\)/)
        })
    })

    it('onError', () => {
        const onError = () => {};
        const spyOnError = sinon.spy(onError); 
        const avatar = mount(
            <Avatar 
                onError={spyOnError}
                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png"
            />
        );
        avatar
            .find('img')
            .at(0)
            .simulate('error');
        expect(spyOnError.callCount).toBe(2);
    })

    it('onClick', () => {
        const onClick = () => {};
        const spyOnClick = sinon.spy(onClick); 
        const avatar = mount(<Avatar onClick={spyOnClick} />);
        avatar.simulate('click');
        expect(spyOnClick.calledOnce).toBe(true);
    })

    it('onClick, topSlot', () => {
        const onClick = () => {};
        const spyOnClick = sinon.spy(onClick); 
        const avatar = mount(<Avatar onClick={spyOnClick} topSlot={{ text: '直播' }}/>);
        avatar.simulate('click');
        expect(spyOnClick.calledOnce).toBe(true);
    })

    it('onMouseEnter', () => {
        const onMouseEnter = () => {};
        const spyOnMouseEnter = sinon.spy(onMouseEnter); 
        const avatar = mount(<Avatar onMouseEnter={spyOnMouseEnter} />);
        avatar.simulate('mouseEnter');
        expect(spyOnMouseEnter.calledOnce).toBe(true);
    })

    it('onMouseEnter, topSlot', () => {
        const onMouseEnter = () => {};
        const spyOnMouseEnter = sinon.spy(onMouseEnter); 
        const avatar = mount(<Avatar onMouseEnter={spyOnMouseEnter} topSlot={{ text: '直播' }} /> );
        avatar.simulate('mouseEnter');
        expect(spyOnMouseEnter.calledOnce).toBe(true);
    })

    it('onMouseLeave', () => {
        const onMouseLeave = () => {};
        const spyOnMouseLeave = sinon.spy(onMouseLeave); 
        const avatar = mount(<Avatar onMouseLeave={spyOnMouseLeave} />);
        avatar.simulate('mouseLeave');
        expect(spyOnMouseLeave.calledOnce).toBe(true);
    })

    it('onMouseLeave, topSlot', () => {
        const onMouseLeave = () => {};
        const spyOnMouseLeave = sinon.spy(onMouseLeave); 
        const avatar = mount(<Avatar onMouseLeave={spyOnMouseLeave} topSlot={{ text: '直播' }} />);
        avatar.simulate('mouseLeave');
        expect(spyOnMouseLeave.calledOnce).toBe(true);
    })

    it('hoverMask', () => {
        const avatar = mount(<Avatar hoverMask='asd' />);
        expect(avatar.simulate('mouseEnter', {}).exists(`.${avartarPrefix}-hover`)).toEqual(true);

    })

});
