import AvatarGroup from '../avatarGroup';
import Avatar from '../index';
import { mount } from 'enzyme';
import React from 'react';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

function getAg(props) {
    const baseAvatarGroup = (
        <AvatarGroup {...props}>
            <Avatar color='red'>LL</Avatar>
            <Avatar >CX</Avatar>
            <Avatar color='amber'>RM</Avatar>
            <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
            <Avatar style={{ backgroundColor: '#87d068' }} >YZ</Avatar>
        </AvatarGroup>
    );
    return mount(baseAvatarGroup, { attachTo: document.getElementById('container') });
}

describe('AvatarGroup', () => {
    it('【className】custom className', () => {
        let props = {
            className: 'test',
        };
        const wrapper = getAg(props);
        expect(wrapper.hasClass('test')).toEqual(true);
    });

    it('avatarGroup overlapFrom', () => {
        const avatarGroup = getAg();
        expect(avatarGroup.props().overlapFrom).toEqual('start');
        avatarGroup.setProps({ overlapFrom: 'end' });
        avatarGroup.update();
        expect(avatarGroup.props().overlapFrom).toEqual('end');
    });

    it('maxCount', () => {
        const avatarGroup = getAg({maxCount: 3});
        expect(
            avatarGroup
            .find(`.${BASE_CLASS_PREFIX}-avatar`)
            .at(3)
            .find(`.${BASE_CLASS_PREFIX}-avatar-content .${BASE_CLASS_PREFIX}-avatar-label`)
            .getDOMNode()
            .textContent
        ).toEqual('+2');
    });

    it('renderMore', () => {
        const avatarGroup = getAg({
            maxCount: 3,
            renderMore: restNumber => <span className='custom'>/{restNumber}</span>
        });
        expect(
            avatarGroup
            .find('.custom')
            .at(0)
            .getDOMNode()
            .textContent
        ).toEqual('/2');
    });

    it('size', () => {
        const element = (
            <div>
                <AvatarGroup size="extra-extra-small" style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
                <AvatarGroup size="extra-small" style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
                <AvatarGroup size="small" style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
                <AvatarGroup size="default" style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
                <AvatarGroup size="large" style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
                <AvatarGroup size="extra-large" style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
            </div>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(1)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-extra-extra-small`)
                .length
        ).toEqual(0);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-extra-extra-small`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(1)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-extra-small`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(2)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-small`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(3)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-default`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(4)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-large`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(5)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-extra-large`)
                .length
        ).toEqual(1);
    });

    it('size', () => {
        const element = (
            <div>
                <AvatarGroup shape='circle' style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
                <AvatarGroup shape='square' style={{ margin: 4 }}>
                    <Avatar color="red">LL</Avatar>
                </AvatarGroup>
            </div>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(1)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-circle`)
                .length
        ).toEqual(0);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-circle`)
                .length
        ).toEqual(1);
        expect(
            wrapper
                .find(`.${BASE_CLASS_PREFIX}-avatar-group`)
                .at(1)
                .find(`.${BASE_CLASS_PREFIX}-avatar`)
                .at(0)
                .find(`.${BASE_CLASS_PREFIX}-avatar-square`)
                .length
        ).toEqual(1);
    });

});
