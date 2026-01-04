import React from 'react';
import { mount, render } from 'enzyme';
import Radio from '../index';
import RadioGroup from '../radioGroup';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

describe('RadioGroup', () => {
    function createRadioGroup(props) {
        return (
            <RadioGroup {...props}>
                <Radio value="A">A</Radio>
                <Radio value="B">B</Radio>
                <Radio value="C">C</Radio>
            </RadioGroup>
        );
    }

    function createRadioGroupByOption(props) {
        const options = [
            { label: 'A', value: 'A' },
            { label: 'B', value: 'B' },
            { label: 'C', value: 'C' },
        ];

        return <RadioGroup {...props} options={options} />;
    }
    it('fire change events when value changes', () => {
        const onChange = jest.fn();

        const wrapper = mount(
            createRadioGroup({
                onChange,
            })
        );
        const radios = wrapper.find('input');

        // uncontrolled component
        wrapper.setState({ value: 'B' });
        radios.at(0).simulate('change');
        expect(onChange.mock.calls.length).toBe(1);

        // controlled component
        wrapper.setProps({ value: 'A' });
        radios.at(1).simulate('change');
        expect(onChange.mock.calls.length).toBe(2);
    });
    it('both of radio and radioGroup will trigger onchange event when they exists', () => {
        const onChange = jest.fn();
        const onChangeRadioGroup = jest.fn();

        const wrapper = mount(
            <RadioGroup onChange={onChangeRadioGroup}>
                <Radio value="A" onChange={onChange}>
                    A
                </Radio>
                <Radio value="B" onChange={onChange}>
                    B
                </Radio>
                <Radio value="C" onChange={onChange}>
                    C
                </Radio>
            </RadioGroup>
        );
        const radios = wrapper.find('input');

        // uncontrolled component
        wrapper.setState({ value: 'B' });
        radios.at(0).simulate('change');
        expect(onChange.mock.calls.length).toBe(1);
        expect(onChangeRadioGroup.mock.calls.length).toBe(1);

        // controlled component
        wrapper.setProps({ value: 'A' });
        radios.at(1).simulate('change');
        expect(onChange.mock.calls.length).toBe(2);
    });

    it('should only trigger once when in group with options', () => {
        const onChange = jest.fn();
        const options = [{ label: 'Bamboo', value: 'Bamboo' }];
        const wrapper = mount(<RadioGroup options={options} onChange={onChange} />);

        wrapper.find('input').simulate('change');
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("won't fire change events when value not changes", () => {
        const onChange = jest.fn();

        const wrapper = mount(
            createRadioGroup({
                onChange,
            })
        );
        const radios = wrapper.find('input');

        // uncontrolled component
        wrapper.setState({ value: 'B' });
        radios.at(1).simulate('change');
        expect(onChange.mock.calls.length).toBe(0);

        // controlled component
        wrapper.setProps({ value: 'A' });
        radios.at(0).simulate('change');
        expect(onChange.mock.calls.length).toBe(0);
    });

    it('optional should correct render', () => {
        const wrapper = mount(createRadioGroupByOption());
        const radios = wrapper.find('input');

        expect(radios.length).toBe(3);
    });

    it('all children should have a name property', () => {
        const GROUP_NAME = 'radiogroup';
        const wrapper = mount(createRadioGroup({ name: GROUP_NAME }));

        wrapper.find('input[type="radio"]').forEach(el => {
            expect(el.props().name).toEqual(GROUP_NAME);
        });
    });

    it('radioGroup button style', () => {
        const radio = mount(
            createRadioGroup({ type: 'button' })
        );
        expect(radio.exists(`.${BASE_CLASS_PREFIX}-radio-buttonRadioGroup`)).toEqual(true);
        expect(radio.exists(`.${BASE_CLASS_PREFIX}-radio-inner-buttonRadio`)).toEqual(true);
    });

    it('radioGroup card style', () => {
        const radioGroup = mount(
            createRadioGroup({ type: 'card' })
        );
        expect(radioGroup.exists(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup`)).toEqual(true);
        radioGroup.unmount();

        const disabledRadioGroup = mount(
            createRadioGroup({ type: 'card', disabled: true, defaultValue: 'A' })
        );
        expect(
            disabledRadioGroup
                .find(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup`)
                .at(0)
                .exists(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup_checked_disabled`)
        ).toEqual(true);
        expect(
            disabledRadioGroup
                .find(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup`)
                .at(1)
                .exists(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup_checked_disabled`)
        ).toEqual(false);
        disabledRadioGroup.unmount();
    });

    it('radioGroup pure card style', () => {
        const radioGroup = mount(
            createRadioGroup({ type: 'pureCard' })
        );
        expect(radioGroup.exists(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup`)).toEqual(true);
        expect(radioGroup.exists(`.${BASE_CLASS_PREFIX}-radio-inner-pureCardRadio`)).toEqual(true);
        radioGroup.unmount();

        const disabledRadioGroup = mount(
            createRadioGroup({ type: 'pureCard', disabled: true, defaultValue: 'A' })
        );
        expect(
            disabledRadioGroup
                .find(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup`)
                .at(0)
                .exists(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup_checked_disabled`)
        ).toEqual(true);
        expect(
            disabledRadioGroup
                .find(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup`)
                .at(1)
                .exists(`.${BASE_CLASS_PREFIX}-radio-cardRadioGroup_checked_disabled`)
        ).toEqual(false);
        disabledRadioGroup.unmount();
    });

    it('The buttonSize of the button type radio', () => {
        const smallRadio = mount(
            createRadioGroup({ type: 'button', buttonSize: 'small' })
        );
        const middleRadio = mount(
            createRadioGroup({ type: 'button', buttonSize: 'middle' })
        );
        const largeRadio = mount(
            createRadioGroup({ type: 'button', buttonSize: 'large' })
        );

        expect(smallRadio.exists(`.${BASE_CLASS_PREFIX}-radio-addon-buttonRadio-small`)).toEqual(true);
        expect(middleRadio.exists(`.${BASE_CLASS_PREFIX}-radio-addon-buttonRadio-middle`)).toEqual(true);
        expect(largeRadio.exists(`.${BASE_CLASS_PREFIX}-radio-addon-buttonRadio-large`)).toEqual(true);
    });

    it('does not trigger Maximum update exceeded when setting radio-group\'s value to NaN', () => {
        const radioGroup = mount(
            createRadioGroup({ value: NaN }),
        );

        expect(radioGroup.exists(`${BASE_CLASS_PREFIX}-radio-checked`)).toEqual(false);
    });
});
