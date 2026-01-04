import React from 'react';
import { mount } from 'enzyme';
import Rating from '../index';
import { ConfigProvider } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const getRating = props => {
    return mount(<Rating {...props} />);
};

describe('Rating', () => {
    it('custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const R = getRating(props);
        expect(R.exists(`.${BASE_CLASS_PREFIX}-rating.test`)).toEqual(true);
        expect(R.find(`.${BASE_CLASS_PREFIX}-rating.test`)).toHaveStyle('color', 'red');
    });

    it('custom count', () => {
        const R1 = mount(<Rating count={10} />);
        expect(R1.find(`.${BASE_CLASS_PREFIX}-rating`).children().length).toEqual(11);
    });

    it('different sizes', () => {
        const sR = getRating({ size: 'small' });
        const dR = getRating();
        expect(sR.exists(`.${BASE_CLASS_PREFIX}-rating-star-small`)).toEqual(true);
        expect(dR.exists(`.${BASE_CLASS_PREFIX}-rating-star-default`)).toEqual(true);
    });

    it('defaultValue', () => {
        const R4 = getRating({ defaultValue: 4 });
        expect(R4.state().value).toEqual(4);
        expect(R4.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(4);
    });

    it('disabled', () => {
        const DR = mount(<Rating disabled defaultValue={3} />);
        expect(DR.exists(`.${BASE_CLASS_PREFIX}-rating-disabled`)).toEqual(true);
    });

    it('allowHalf', () => {
        let props = {
            allowHalf: true,
            defaultValue: 3.5,
        };
        const R35 = getRating(props);
        expect(R35.state().value).toEqual(3.5);
        expect(R35.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(3);
        expect(R35.find(`.${BASE_CLASS_PREFIX}-rating-star-half`).length).toEqual(1);
    });

    it('custom character', () => {
        let props = {
            character: '赞',
        };
        const R = getRating(props);
        expect(
            R.find(`.${BASE_CLASS_PREFIX}-rating-star-second`)
                .at(0)
                .getDOMNode().textContent
        ).toEqual('赞');
    });

    it('onChange callback', () => {
        let onChange = v => {
            // debugger;
        };
        let spyOnChange = sinon.spy(onChange);
        let props = {
            onChange: spyOnChange,
            defaultValue: 3,
        };
        const R = getRating(props);
        let stars = R.find('div[role="radio"]');
        const event = {};
        stars.at(0).simulate('click', event);
        expect(R.state().value).toEqual(1);
        expect(spyOnChange.calledOnce).toBe(true);
        expect(spyOnChange.calledWithMatch(1)).toBe(true);
    });

    it('controlled value', () => {
        const R = getRating({ value: 2 });
        expect(R.state().value).toEqual(2);
        expect(R.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(2);
        R.setProps({ value: 5 });
        expect(R.state().value).toEqual(5);
        expect(R.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(5);
    });

    it('onHoverChange', () => {
        let onHoverChange = v => {};
        let spyHoverChange = sinon.spy(onHoverChange);
        let props = {
            onHoverChange: spyHoverChange,
        };
        const R = getRating(props);
        let stars = R.find('div[role="radio"]');
        const event = {};
        stars.at(1).simulate('mouseMove', event);
        expect(spyHoverChange.calledWithMatch(2)).toBe(true);
        let ul = R.find('ul');
        ul.simulate('mouseLeave', {});
        expect(spyHoverChange.callCount).toBe(2);
        R.unmount();
    });

    it('onHoverChange + allowHalf', () => {
        let onHoverChange = v => {};
        let spyHoverChange = sinon.spy(onHoverChange);
        let props = {
            onHoverChange: spyHoverChange,
            allowHalf: true
        };
        const R = getRating(props);
        let stars = R.find(`.${BASE_CLASS_PREFIX}-rating-star-wrapper`);
        const event = {};
        stars.at(1).simulate('mouseMove', event);
        expect(spyHoverChange.calledWithMatch(2)).toBe(true);
        let ul = R.find('ul');
        ul.simulate('mouseLeave', {});
        expect(spyHoverChange.callCount).toBe(2);
        R.unmount();
    });

    it('allowClear', () => {
        let props = {
            allowClear: true,
            defaultValue: 2,
        };
        const R = getRating(props);
        expect(R.state().value).toEqual(2);
        let stars = R.find('div[role="radio"]');
        const event = {};
        stars.at(1).simulate('click', event);
        expect(R.state().value).toEqual(0);
    });

    it('tooltips', () => {
        let tooltips = ['terrible', 'bad', 'normal', 'good', 'wonderful'];
        let props = {
            tooltips,
        };
        const R = getRating(props);
        let stars = R.find('div[role="radio"]');
        const event = {};
        stars.at(1).simulate('mouseMove', event);
        expect(R.find(`.${BASE_CLASS_PREFIX}-tooltip-wrapper`).getDOMNode().textContent).toEqual(tooltips[1]);
    });


    it('onFocus & onBlur', () => {
        let onFocus = () => {};
        let onBlur = () => {};
        let spyOnFocus = sinon.spy(onFocus);
        let spyOnBlur = sinon.spy(onBlur);
        let props = {
            defaultValue: 2,
            onFocus: spyOnFocus,
            onBlur: spyOnBlur
        };
        const R = getRating(props);
        let ul = R.find('ul')
        ul.simulate('focus', {});
        expect(spyOnFocus.calledOnce).toBe(true);
        ul.simulate('blur', {});
        expect(spyOnBlur.calledOnce).toBe(true);
    });

    it('onKeyDown', () => {
        let onKeyDown = () => {};
        let spyOnKeydown = sinon.spy(onKeyDown);
        let props = {
            defaultValue: 2,
            onKeyDown: spyOnKeydown
        };
        const R = getRating(props);
        let ul = R.find('ul');
        ul.simulate('keyDown', { key: 'ArrowLeft' });
        expect(R.state().value).toEqual(1);
        ul.simulate('keyDown', { key: 'ArrowRight' });
        expect(R.state().value).toEqual(2);
        expect(spyOnKeydown.callCount).toEqual(2);
        let allowHalfProps = {
            defaultValue: 2.5,
            allowHalf: true,
        };
        const HalfR = getRating(allowHalfProps);
        let halfUl = HalfR.find('ul');
        halfUl.simulate('keyDown', { key: 'ArrowLeft' });
        expect(HalfR.state().value).toEqual(2);
        halfUl.simulate('keyDown', { key: 'ArrowRight' });
        halfUl.simulate('keyDown', { key: 'ArrowRight' });
        expect(HalfR.state().value).toEqual(3);
    });

    it('rtl mode', () => {
        // default
        let context = {
            direction: 'rtl'
        }
        let props = {
            defaultValue: 2,
            className: 'test'
        };
        const RWithWrapper = mount(<ConfigProvider direction='rtl'><Rating {...props}/></ConfigProvider>);
        let ul = RWithWrapper.find('ul');
        ul.simulate('keyDown', { key: 'ArrowLeft' });
        let R = RWithWrapper.find(Rating);
        expect(R.state().value).toEqual(3);
        ul.simulate('keyDown', { key: 'ArrowRight' });
        expect(R.state().value).toEqual(2);
        // allowHalf
        let allowHalfProps = {
            defaultValue: 2.5,
            allowHalf: true,
        };
        let HalfRWithWrapper = mount(<ConfigProvider direction='rtl'><Rating {...allowHalfProps}/></ConfigProvider>);
        let halfUl = HalfRWithWrapper.find('ul');
        let HalfR = HalfRWithWrapper.find(Rating);
        let stars = HalfR.find('div[role="radio"]');

        halfUl.simulate('keyDown', { key: 'ArrowLeft' });
        expect(HalfR.state().value).toEqual(3);
        halfUl.simulate('keyDown', { key: 'ArrowRight' });
        halfUl.simulate('keyDown', { key: 'ArrowRight' });
        expect(HalfR.state().value).toEqual(2);
    })

    it('click much times', () => {
        const R = getRating({});
        let stars = R.find('div[role="radio"]');
        const event = {};
        stars.at(1).simulate('click', event);
        expect(R.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(2);
        stars.at(1).simulate('click', event);
        expect(R.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(0);
        stars.at(1).simulate('click', event);
        expect(R.find(`.${BASE_CLASS_PREFIX}-rating-star-full`).length).toEqual(2);
    });
});
