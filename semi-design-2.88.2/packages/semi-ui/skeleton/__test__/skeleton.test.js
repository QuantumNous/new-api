import React from 'react';
import { mount } from 'enzyme';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import Skeleton from '../index';

const { Avatar, Image, Title, Button, Paragraph } = Skeleton;

describe('Skeleton', () => {
    it('basic loading', () => {
        const node = mount(
            <Skeleton placeholder={<Avatar />} loading>
                <div className="content">content</div>
            </Skeleton>
        );
        expect(node.exists(`.${BASE_CLASS_PREFIX}-skeleton`)).toEqual(true);
        node.setProps({ loading: false });
        expect(node.exists(`.${BASE_CLASS_PREFIX}-skeleton`)).toEqual(false);
        expect(node.exists('.content')).toEqual(true);
    });
    it('kits render', () => {
        const avatarNode = mount(<Avatar />);
        const imageNode = mount(<Image />);
        const titleNode = mount(<Title />);
        const btnNode = mount(<Button />);
        const paraNode = mount(<Paragraph />);
        expect(avatarNode.exists(`.${BASE_CLASS_PREFIX}-skeleton-avatar`)).toEqual(true);
        expect(imageNode.exists(`.${BASE_CLASS_PREFIX}-skeleton-image`)).toEqual(true);
        expect(titleNode.exists(`.${BASE_CLASS_PREFIX}-skeleton-title`)).toEqual(true);
        expect(btnNode.exists(`.${BASE_CLASS_PREFIX}-skeleton-button`)).toEqual(true);
        expect(paraNode.exists(`.${BASE_CLASS_PREFIX}-skeleton-paragraph`)).toEqual(true);
    });
});
