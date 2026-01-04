import React from 'react';
import { mount, render } from 'enzyme';
import { Checkbox, CheckboxGroup } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const options = [
    { label: 'Abc', value: 'abc' },
    { label: 'Hotsoon', value: 'hotsoon' },
    { label: 'Pipixia', value: 'pipixia' },
    { label: 'Toutiao', value: 'toutiao' },
];

function getCG(props) {
    if (!props.children && !props.options) {
        props.options = options;
    }
    return mount(<CheckboxGroup {...props} />);
}

describe('CheckboxGroup', () => {
    it('className & style', () => {
        let checkboxGroup = getCG({
            style: { color: 'red' },
            className: 'cbg-test',
        });
    });

    it('declare via options', () => {
        let checkboxGroup = getCG({});
        let group = checkboxGroup.find(`div.${BASE_CLASS_PREFIX}-checkboxGroup`);
        expect(group.children().length).toEqual(4);
        let labels = checkboxGroup.find(`.${BASE_CLASS_PREFIX}-checkbox-addon`);
        expect(labels.at(0).text()).toEqual('Abc');
        expect(labels.at(1).text()).toEqual('Hotsoon');
        expect(labels.at(2).text()).toEqual('Pipixia');
        expect(labels.at(3).text()).toEqual('Toutiao');
    });

    it('declare via children', () => {
        let children = options.map(item => <Checkbox value={item.value}>{item.label}</Checkbox>);
        let props = {
            children,
        };
        let checkboxGroup = getCG(props);
        let group = checkboxGroup.find(`div.${BASE_CLASS_PREFIX}-checkboxGroup`);
        expect(group.children().length).toEqual(4);
        let labels = checkboxGroup.find(`.${BASE_CLASS_PREFIX}-checkbox-addon`);
        expect(labels.at(0).text()).toEqual('Abc');
        expect(labels.at(1).text()).toEqual('Hotsoon');
        expect(labels.at(2).text()).toEqual('Pipixia');
        expect(labels.at(3).text()).toEqual('Toutiao');
    });

    it('direction', () => {
        let props = {
            direction: 'horizontal',
        };
        let checkboxgroup = getCG(props);
        expect(checkboxgroup.exists(`div.${BASE_CLASS_PREFIX}-checkboxGroup-horizontal`)).toEqual(true);
    });

    it('name', () => {
        // all children should have a name property
        const wrapper = mount(<Checkbox.Group name="checkboxgroup" options={['Yes', 'No']} />);
        wrapper.find('input[type="checkbox"]').forEach(el => {
            expect(el.props().name).toEqual('checkboxgroup');
        });
    });

    it('group - onChange', () => {
        let onChange = checkedValue => { };
        let spyOnChange = sinon.spy(onChange);
        let props = {
            onChange: spyOnChange,
        };
        let cg = getCG(props);
        let checkboxs = cg.find(`.${BASE_CLASS_PREFIX}-checkbox-inner`);
        checkboxs.at(0).simulate('click', {});
        expect(spyOnChange.getCall(0).calledWithMatch(['abc'])).toEqual(true);
        checkboxs.at(1).simulate('click', {});
        expect(spyOnChange.getCall(1).calledWithMatch(['abc', 'hotsoon'])).toEqual(true);
        checkboxs.at(2).simulate('click', {});
        expect(spyOnChange.getCall(2).calledWithMatch(['abc', 'hotsoon', 'pipixia'])).toEqual(true);
        expect(spyOnChange.callCount).toEqual(3);
    });

    it('disabled', () => {
        let spyOnChange = sinon.spy(() => { });

        let props = {
            onChange: spyOnChange,
            disabled: true,
        };
        let cg = getCG(props);
        // does not trigger onChange callback of both Checkbox and CheckboxGroup when CheckboxGroup is disabled
        expect(cg.find(`.${BASE_CLASS_PREFIX}-checkbox-disabled`).length).toEqual(4);
        let checkboxs = cg.find(`.${BASE_CLASS_PREFIX}-checkbox-inner`);
        checkboxs.at(0).simulate('click', {});
        expect(spyOnChange.callCount).toEqual(0);
    });

    it('defaultValue', () => {
        let spyOnChange = sinon.spy(ca => { });
        let props = {
            onChange: spyOnChange,
            defaultValue: ['hotsoon'],
        };
        let cg = getCG(props);
        let checkboxs = cg.find(`.${BASE_CLASS_PREFIX}-checkbox-inner`);
        expect(checkboxs.at(1).hasClass(`${BASE_CLASS_PREFIX}-checkbox-inner-checked`)).toEqual(true);
        checkboxs.at(0).simulate('click', {});
        expect(spyOnChange.calledOnceWith(['hotsoon', 'abc'])).toEqual(true);
    });

    it('should be controlled by value', () => {
        const options = [{ label: 'Apple', value: 'Apple' }, { label: 'Orange', value: 'Orange' }];

        const wrapper = getCG({ options });
        expect(wrapper.instance().state.value).toEqual([]);
        wrapper.setProps({ value: ['Apple'] });
        expect(wrapper.instance().state.value).toEqual(['Apple']);
    });

    it('should trigger onChange in sub Checkbox', () => {
        const spyItemChange = sinon.spy(() => { });
        const spyGroupChange = sinon.spy(() => { });
        const cg = mount(
            <CheckboxGroup onChange={spyGroupChange}>
                <Checkbox value="my" onChange={spyItemChange} />
            </CheckboxGroup>
        );
        let checkboxs = cg.find(`.${BASE_CLASS_PREFIX}-checkbox-inner`);
        checkboxs.at(0).simulate('click', {});
        expect(spyItemChange.calledOnce).toEqual(true);
        expect(spyGroupChange.calledOnce).toEqual(true);
    });

    it('checkboxGroup card style', () => {
        const checkboxGroup = getCG({ type: 'card' });
        expect(checkboxGroup.exists(`.${BASE_CLASS_PREFIX}-checkbox-cardType`)).toEqual(true);
        checkboxGroup.unmount();

        const disabledCheckboxGroup = getCG({ type: 'card', disabled: true, defaultValue: 'abc' });
        expect(
            disabledCheckboxGroup
            .find(`.${BASE_CLASS_PREFIX}-checkbox-cardType`)
            .at(0)
            .exists(`.${BASE_CLASS_PREFIX}-checkbox-cardType_checked_disabled`)
        ).toEqual(true);
        expect(
            disabledCheckboxGroup
            .find(`.${BASE_CLASS_PREFIX}-checkbox-cardType`)
            .at(1)
            .exists(`.${BASE_CLASS_PREFIX}-checkbox-cardType_checked_disabled`)
        ).toEqual(false);
        disabledCheckboxGroup.unmount();
    });

    it('checkboxGroup pure card style', () => {
        const checkboxGroup = getCG({ type: 'pureCard' });
        expect(checkboxGroup.exists(`.${BASE_CLASS_PREFIX}-checkbox-cardType`)).toEqual(true);
        expect(checkboxGroup.exists(`.${BASE_CLASS_PREFIX}-checkbox-inner-pureCardType`)).toEqual(true);
        checkboxGroup.unmount();

        const disabledCheckboxGroup = getCG({ type: 'pureCard', disabled: true, defaultValue: 'abc' });
        expect(
            disabledCheckboxGroup
            .find(`.${BASE_CLASS_PREFIX}-checkbox-cardType`)
            .at(0)
            .exists(`.${BASE_CLASS_PREFIX}-checkbox-cardType_checked_disabled`)
        ).toEqual(true);
        expect(
            disabledCheckboxGroup
            .find(`.${BASE_CLASS_PREFIX}-checkbox-cardType`)
            .at(1)
            .exists(`.${BASE_CLASS_PREFIX}-checkbox-cardType_checked_disabled`)
        ).toEqual(false);
        disabledCheckboxGroup.unmount();
    });
});
