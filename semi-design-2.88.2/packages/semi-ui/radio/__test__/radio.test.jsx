import React from 'react';
import { mount } from 'enzyme';
import Radio from '../index';
import RadioInner from '../radioInner';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

describe('radio', () => {

    it('radio should work basically', () => {
        const radio = mount(
            <Radio />
        );
        const radioDOM = radio.find('input');

        expect(radioDOM.exists()).toEqual(true);
        expect(Boolean(radioDOM.checked)).toEqual(false);
        expect(Boolean(radioDOM.disabled)).toEqual(false);

    });

    it('radio default checked', () => {
        const radio = mount(
            <Radio checked />
        );

        const radioDOM = radio.find('input').getDOMNode();

        expect(Boolean(radioDOM.checked)).toEqual(true);

    });

    it('radio default disabled', () => {
        const radio = mount(
            <Radio disabled />
        );

        const radioDOM = radio.find('input').getDOMNode();

        expect(Boolean(radioDOM.disabled)).toEqual(true);

    });

    it('radio onChange', () => {
        const onChange = sinon.spy(value => {});
        const onChange2 = sinon.spy(value => {});
        const radio = mount(<Radio onChange={onChange} />);
        const advancedRadio = mount(<Radio mode="advanced" onChange={onChange2} />);

        // 普通 Radio
        const elem = radio.find('input');
        elem.simulate('change', { target: { checked: true } });
        expect(onChange.calledOnce).toBe(true);
        expect(onChange.getCall(0).args[0].target.checked).toBe(true);

        // mode=advanced Radio
        const elem2 = advancedRadio.find('input');
        elem2.simulate('change', { target: { checked: true } });
        expect(onChange2.calledOnce).toBe(true);
        // 验证是否能正确获取参数
        expect(onChange2.getCall(0).args[0].target.checked).toBe(true);
    });

    it('radio advanced mode', () => {
        // Radio即使不是mode=advanced测试时也可以通过调用onChange修改选中状态
        // 而用户点击时，由于input的type为radio，用户点击这时不会触发onChange
        // 这个用例用于验证onChange是否能跑通
        const onChange = sinon.spy(value => {});
        const wrapper = mount(<Radio mode="advanced" onChange={onChange}>允许取消选择</Radio>);

        const radioInner = wrapper.find(RadioInner);
        wrapper
            .find('input')
            .first()
            .simulate('change', { target: { checked: true, stopPropagation: () => {}, preventDefault: () => {} } });
        expect(radioInner.state().checked).toBe(true);

        wrapper
            .find('input')
            .first()
            .simulate('change', { target: { checked: false, stopPropagation: () => {}, preventDefault: () => {} } });
        expect(radioInner.state().checked).toBe(false);
    });

    it('radio button style', () => {
        const radio = mount(
            <Radio type="button" />
        );
        expect(radio.exists(`.${BASE_CLASS_PREFIX}-radio-buttonRadioComponent`)).toEqual(true);
    });
});