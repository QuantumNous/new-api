import React from 'react';
import { mount } from 'enzyme';
import { Checkbox } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

function getCb(props) {
    return mount(<Checkbox children={'Semi Design'} {...props} />);
}

describe('checkbox', () => {
    it('className & style', () => {
        const checkbox = getCb({
            className: 'test',
            style: { color: 'red' },
        });
        expect(checkbox.exists(`.${BASE_CLASS_PREFIX}-checkbox.test`)).toEqual(true);
        expect(checkbox.find(`.${BASE_CLASS_PREFIX}-checkbox.test`)).toHaveStyle('color', 'red');
    });

    it('should work basically & click behaviour', () => {
        const checkbox = getCb();
        let checkboxDOM = checkbox.find('input');
        expect(checkboxDOM.exists()).toEqual(true);
        expect(checkbox.state().checked).toEqual(false);
        expect(!!checkboxDOM.disabled).toEqual(false);
        checkbox.find(`.${BASE_CLASS_PREFIX}-checkbox`).simulate('click', {});
        expect(checkbox.state().checked).toEqual(true);
    });

    it('defaultChecked', () => {
        const checkbox = getCb({ defaultChecked: true });
        const checkboxDOM = checkbox.find('input').getDOMNode();
        expect(!!checkboxDOM.checked).toEqual(true);
    });

    it('checked, controlled mode', () => {
        const checkbox = getCb({ checked: true });
        expect(checkbox.state().checked).toEqual(true);
        expect(checkbox.find('input').getDOMNode().checked).toEqual(true);
        expect(checkbox.exists(`.${BASE_CLASS_PREFIX}-checkbox-inner-checked`)).toEqual(true);

        checkbox.setProps({ checked: false });
        checkbox.update();
        expect(checkbox.state().checked).toEqual(false);
        expect(checkbox.find('input').getDOMNode().checked).toEqual(false);
        expect(checkbox.exists(`.${BASE_CLASS_PREFIX}-checkbox-inner-checked`)).toEqual(false);

        checkbox.setProps({ checked: true }) 
        checkbox.update();
        expect(checkbox.state().checked).toEqual(true);
        expect(checkbox.find('input').getDOMNode().checked).toEqual(true);
        expect(checkbox.exists(`.${BASE_CLASS_PREFIX}-checkbox-inner-checked`)).toEqual(true);

        // case like formApi.reset() will case checked  true => undefined
        // can't setProps({}) here, otherwise props compare can't work
        checkbox.setProps({ checked: undefined });
        checkbox.update();
        expect(checkbox.state().checked).toEqual(false);
        expect(checkbox.find('input').getDOMNode().checked).toEqual(false);
        expect(checkbox.exists(`.${BASE_CLASS_PREFIX}-checkbox-inner-checked`)).toEqual(false);
    });
 
    it('disabled', () => {
        const checkbox = getCb({ disabled: true });
        expect(checkbox.exists(`.${BASE_CLASS_PREFIX}-checkbox-disabled`)).toEqual(true);
        expect(checkbox.state().checked).toEqual(false);
        checkbox.find(`.${BASE_CLASS_PREFIX}-checkbox`).simulate('click', {});
        expect(checkbox.state().checked).toEqual(false);
    });

    it('onChange', () => {
        const onChange = sinon.spy(value => {});
        const checkbox = mount(<Checkbox onChange={onChange} />);
        checkbox.find(`.${BASE_CLASS_PREFIX}-checkbox`).simulate('click', {});
        expect(onChange.getCall(0).args[0].target.checked).toEqual(true);
        checkbox.find(`.${BASE_CLASS_PREFIX}-checkbox`).simulate('click', {});
        expect(onChange.getCall(1).args[0].target.checked).toEqual(false);
    });

    it('extra', () => {
        let text = 'abcd';
        const checkbox = getCb({ extra: text });
        expect(checkbox.find(`.${BASE_CLASS_PREFIX}-checkbox-extra`).text()).toEqual(text);
    });
});
